exports = function(payload, response)
{
  // Query params, e.g. '?arg1=hello&arg2=world' => {arg1: "hello", arg2: "world"}
  const {cluster} = payload.query;

  // Raw request body (if the client sent one).
  // This is a binary object that can be accessed as a string using .text()
  const body = payload.body;
  
  const project = context.values.get(`auto-project`);
  const username = context.values.get(`auto-username`);
  const password = context.values.get(`auto-password`);

  return context.functions.execute("modifyClusters", project, username, password, [cluster], JSON.parse(body.text()));
};