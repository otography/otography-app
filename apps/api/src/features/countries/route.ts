import { Hono } from "hono";
// import { countriesRepository } from "./repository";

const countries = new Hono().get("/countries", async (c) => {
	// const result = await countriesRepository.findAll();
	// return c.json(result);
	return c.json([{ id: 1, name: "Japan" }]);
});

// Example: findById with not found check
// countries.get("/countries/:id", async (c) => {
//   const id = Number(c.req.param("id"));
//   const country = await countriesRepository.findById(id);
//
//   if (!country) {
//     return c.json({ error: "Not found" }, 404);
//   }
//
//   return c.json(country);
// });

export { countries };
