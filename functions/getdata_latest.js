exports = async function(org, username, password){

  const promises = [
    getInvoices(org, username, password),
    getOrg(org, username, password),
    getProjects(org, username, password)
  ];
  await Promise.all(promises);
  return {"org": org, "status": "success!"};
};

getInvoices = async function(org, username, password)
{
  
  const refresh = context.values.get(`refreshInvoiceData`);
  if (!refresh) return Promise.resolve();

  const args = {
    "scheme": `https`,
    "host": `cloud.mongodb.com`,
    "username": username,
    "password": password,
    "digestAuth": true,
    "path": `/api/atlas/v1.0/orgs/${org}/invoices`
  };

  const response = await context.http.get(args);
  const body = JSON.parse(response.body.text());
  if (response.statusCode != 200) throw {"error": body.detail, "fn": "getInvoices", "statusCode": response.statusCode};

  const collection = context.services.get(`mongodb-atlas`).db(`billing`).collection(`billingdata`);
  const invoicedata = await collection.find({}, {"_id": 0, "id": 1, "updated": 1}).sort({"updated":-1}).toArray();

  let promises = [];
  body.results.forEach(result => {
    const invoice = invoicedata.find(elem => elem.id === result.id);
     
    if (result.statusName == "PENDING" || invoice === undefined || (invoicedata && result.updated >= invoicedata[0].updated)) {
  
      promises.push(getInvoice(org, username, password, result.id));
    }
  });
  return Promise.all(promises);
};

getInvoice = async function(org, username, password, invoice)
{ 
  const collection = context.services.get(`mongodb-atlas`).db(`billing`).collection(`billingdata`);

  const args = {
    "scheme": `https`,
    "host": `cloud.mongodb.com`,
    "username": username,
    "password": password,
    "digestAuth": true,
    "path": `/api/atlas/v1.0/orgs/${org}/invoices/${invoice}`
  };
  
  const response = await context.http.get(args);
  const body = JSON.parse(response.body.text());
  if (response.statusCode != 200) throw {"error": body.detail, "fn": "getInvoice", "statusCode": response.statusCode};
  return collection.replaceOne({"id": body.id}, body, {"upsert": true});
};

getOrg = async function(org, username, password)
{

  const refresh = context.values.get(`refreshOrgData`);
  if (!refresh) return Promise.resolve();

  const collection = context.services.get(`mongodb-atlas`).db(`billing`).collection(`orgdata`);  

  const args = {
    "scheme": `https`,
    "host": `cloud.mongodb.com`,
    "username": username,
    "password": password,
    "digestAuth": true,
    "path": `/api/atlas/v1.0/orgs/${org}`
  };

  const response = await context.http.get(args);
  const body = JSON.parse(response.body.text());
  if (response.statusCode != 200) throw {"error": body.detail, "fn": "getOrg", "statusCode": response.statusCode};
  return collection.replaceOne({"_id": org}, {"_id": org, "name": body.name}, {"upsert": true});
};

getProjects = async function(org, username, password)
{
  
  const refresh = context.values.get(`refreshProjectData`);
  if (!refresh) return Promise.resolve();

  const collection = context.services.get(`mongodb-atlas`).db(`billing`).collection(`projectdata`);

  const args = {
    "scheme": `https`,
    "host": `cloud.mongodb.com`,
    "username": username,
    "password": password,
    "digestAuth": true,
    "path": `/api/atlas/v1.0/orgs/${org}/groups`
  };
  
  const response = await context.http.get(args);
  const body = JSON.parse(response.body.text());
  if (response.statusCode != 200) throw {"error": body.detail, "fn": "getProjects", "statusCode": response.statusCodet};

  let promises = [];
  body.results.forEach(result => {
    promises.push(collection.replaceOne({"_id": result.id}, {"_id": result.id, "name": result.name}, {"upsert": true}));
  });
  return Promise.all(promises);
};
