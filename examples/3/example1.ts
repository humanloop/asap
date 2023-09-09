interface ApiObject {
  id: string;
  description: string;
}

function logApiObject(apiObject: ApiObject) {
  console.log("Logging ApiObject:");
  console.log(apiObject.id);
  console.log(apiObject.name);
  console.log(apiObject.description);
}
