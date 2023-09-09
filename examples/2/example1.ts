import { Thing, getThing } from "./example2";

const THINGS: Thing[] = [
  { id: 234, name: "thing234" },
  { id: 124, name: "thing124" },
  { id: 209, name: "thing209" },
];

const thing: Thing = getThing(123, THINGS);
