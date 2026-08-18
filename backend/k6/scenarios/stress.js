import { hitEndpoints } from "../endpoints.js";

export const options = {
  stages: [
    { duration: "10s", target: 100 },
    { duration: "40s", target: 100 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  hitEndpoints();
}

export function handleSummary(data) {
  return {
    "k6-stress-results.json": JSON.stringify(data),
  };
}

