exports = async function(){
 const promises = [
   //If you want to include several orgs in the one dashboard, you'll need to call getOrgData for each one, with appropriate org IDs and API keys.
   
    context.functions.execute("getOrgData", context.values.get("billing-org"), context.values.get("billing-username"), context.values.get("billing-password"))
      .catch(err => { return err; }),
    
  ];
  const results = await Promise.all(promises);
  return {"status": "complete!", "results": results };
};
