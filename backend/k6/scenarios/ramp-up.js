import { hitEndpoints } from "./endpoints.js";

export const options = {
  stages: [
    { duration: "20s", target: 10 },
    { duration: "20s", target: 30 },
    { duration: "20s", target: 50 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  hitEndpoints();
}
