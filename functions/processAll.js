exports = async function(){
  const promises = [
   //TO BE UPDATED IF YOU WANT TO ADD SEVERAL ORGANISATION
   context.functions.execute("processOrgData", context.values.get("billing-org"))
      .catch(err => { return err; }),
  ];
  const results = await Promise.all(promises);
  return {"status": "complete!", "results": results };
};
