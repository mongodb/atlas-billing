exports = async function(org){

  // find the last date in our materialized output (so we know where we are)
  // need to do this before we update any data!
  const collection = context.services.get(`mongodb-atlas`).db(`billing`).collection(`details`);
  const dates = await collection.find({"org.id":org},{"date":1, "_id":0}).sort({"date": -1}).limit(1).toArray();
  const date = (dates.length && (dates[0].date instanceof Date) ? dates[0].date : undefined);
  await processAll(org, date);
  return {"org": org, "status": ( await verifyData(org) ? "success!" : "failed" )};
};

processAll = async function(org, date)
{
  
  const collection = context.services.get(`mongodb-atlas`).db(`billing`).collection(`billingdata`);

  let pipeline = [];
  
  // only look at the invoices for this org
  pipeline.push({ "$match": { "orgId": org }});
  
  // quick filter to avoid processing older invoices
  // (anything where the endData is more recent than
  // a month prior to the last date we've processed).
  // We filter on _id ObjectIds so we can use the default index.
  if (date instanceof Date) {
    const startfrom = new Date(date - 1000 * 3600 * 24 * 31);
    pipeline.push({ "$match": { "_id": { "$gte": objectIdFromTimestamp(startfrom) }}});
  }

  pipeline.push({ "$lookup": {
    "from": "orgdata",
    "localField": "orgId",
    "foreignField": "_id",
    "as": "orgdata"
  }});
  pipeline.push({ "$unwind": { "path": "$orgdata", "preserveNullAndEmptyArrays": true }});

  // not interested in empty lineItem records
  pipeline.push({ "$unwind": { "path": "$lineItems", "preserveNullAndEmptyArrays": false }});

  // only process the new data
  // (where the date is greater than the last one we've processed)
  pipeline.push({ "$addFields": { "date": { "$dateFromString": { dateString: "$lineItems.startDate" }}}});
  if (date instanceof Date) {
    pipeline.push({ "$match": { "date": { "$gt": date }}});
  }
  
  // without a sort we're reliant on the data being presented in sorted order
  // but without spilling to disk this sort stage falls over on the larger result sets
  // pipeline.push({ "$sort": { "lineItems.startDate": 1 }});

  pipeline.push({ "$project": {
    "_id": 0,
    "org": { "id": "$orgId", "name": { "$ifNull": ["$orgdata.name", "$orgId" ]} },
    "project": { "id": "$lineItems.groupId", "name": "$lineItems.groupName"},
    "cluster": { "$ifNull": ["$lineItems.clusterName", "--n/a--" ]},
    "sku": "$lineItems.sku",
    "cost": { "$toDecimal": { "$divide": [ "$lineItems.totalPriceCents", 100 ]}},
    "date": 1,
    provider: {
      '$switch': {
        branches: [
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: 'AWS' }},
            then: 'AWS'
          },
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: 'AZURE' }},
            then: 'AZURE'
          },
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: 'GCP' }},
            then: 'GCP'
          },
        ],
        default: 'n/a'
      }
    },
    instance: { '$ifNull': [{ '$arrayElemAt': [ { '$split': ['$lineItems.sku', '_INSTANCE_'] }, 1 ] }, 'non-instance']},
    category: {
      '$switch': {
        branches: [
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: "_INSTANCE" }},
            then: 'instances'
          },
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: 'BACKUP' }},
            then: 'backup'
          },
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: 'PIT_RESTORE' }},
            then: 'backup'
          },
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: 'DATA_TRANSFER' }},
            then: 'data xfer'
          },
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: 'STORAGE' }},
            then: 'storage'
          },
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: 'BI_CONNECTOR' }},
            then: 'bi connector'
          },
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: 'DATA_LAKE' }},
            then: 'data lake'
          },
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: 'AUDITING' }},
            then: 'audit'
          },
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: 'ATLAS_SUPPORT' }},
            then: 'support'
          },
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: 'FREE_SUPPORT' }},
            then: 'free support'
          },
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: 'CHARTS' }},
            then: 'charts'
          },
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: 'REALM' }},
            then: 'app services'
          },
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: 'SERVERLESS' }},
            then: 'serverless'
          },
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: 'SECURITY' }},
            then: 'security'
          },
          {
            case: { $regexMatch: { input: '$lineItems.sku', regex: 'PRIVATE_ENDPOINT' }},
            then: 'private endpoint'
          },
        ],
        default: 'other'
      }
    },
  }});
  
  pipeline.push({ "$merge": { "into": "details" }});

  return collection.aggregate(pipeline, { allowDiskUse: true}).toArray();
};

verifyData = async function(org)
{

  // make sure the number of docs in the lineItems array matches the data in the details collection
  const results = Promise.all([countSrc(org), countDst(org)]);
  return results[0] == results[1];
};

countSrc = async function(org)
{
  
  const collection = context.services.get(`mongodb-atlas`).db(`billing`).collection(`billingdata`);
  let pipeline = [];
  pipeline.push({ "$match": { "orgId": org }});
  pipeline.push({ "$unwind": { "path": "$lineItems", "preserveNullAndEmptyArrays": false }});
  pipeline.push({ "$count": "id" });
  const docs = await collection.aggregate(pipeline).toArray();
  return docs[0].id;
};

countDst = async function(org)
{
  const collection = context.services.get(`mongodb-atlas`).db(`billing`).collection(`details`);
  return collection.count({ "org.id": org });
};

objectIdFromTimestamp = function(timestamp) {
  /* Convert string date to Date object (otherwise assume timestamp is a date) */
  if (typeof(timestamp) == 'string') {
      timestamp = new Date(timestamp);
  }

  /* Convert date object to hex seconds since Unix epoch */
  var hexSeconds = Math.floor(timestamp/1000).toString(16);

  /* Create an ObjectId with that hex timestamp */
  var constructedObjectId = BSON.ObjectId(hexSeconds + "0000000000000000");

  return constructedObjectId
};