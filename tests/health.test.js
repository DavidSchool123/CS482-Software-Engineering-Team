const request = require("supertest");
const app = require("../app");

describe("Poker Face API", () => {
  test("GET /api/health returns status 200", async () => {
    const response = await request(app)
      .get("/api/health");

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe(
      "Poker Face API is running!"
    );
  });
});
