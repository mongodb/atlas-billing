exports = async function(){
 const promises = [
   //TO BE UPDATED IF YOU HAVE SEVERAL ORGANISATION
   
    context.functions.execute("getdata_latest", context.values.get("billing-org"), context.values.get("billing-username"), context.values.get("billing-password"))
      .catch(err => { return err; }),
    
  ];
  const results = await Promise.all(promises);
  return {"status": "complete!", "results": results };
};
