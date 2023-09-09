const THINGS: { id: number; name: string }[] = [
  { id: 234, name: "thing234" },
  { id: 124, name: "thing124" },
  { id: 209, name: "thing209" },
];

function main() {
  const myThing = THINGS.find((x) => x.id == 123);
  console.log(myThing.name);
}
