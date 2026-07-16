import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/model3d/route";

const ORIGINAL_KEY = process.env.MESHY_API_KEY;

function configure() {
  process.env.MESHY_API_KEY = "key";
}

function unconfigure() {
  delete process.env.MESHY_API_KEY;
}

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.MESHY_API_KEY;
  else process.env.MESHY_API_KEY = ORIGINAL_KEY;
});

describe("POST /api/model3d", () => {
  it("returns 503 when unconfigured", async () => {
    unconfigure();
    const req = new NextRequest("http://localhost/api/model3d", {
      method: "POST",
      body: JSON.stringify({ imageDataUrl: "data:image/jpeg;base64,x" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("MESHY_API_KEY 미설정");
  });

  it("returns 400 when configured but imageDataUrl missing the data:image/ prefix", async () => {
    configure();
    const req = new NextRequest("http://localhost/api/model3d", {
      method: "POST",
      body: JSON.stringify({ imageDataUrl: "not-a-data-url" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("imageDataUrl 필요");
  });

  it("returns 400 when configured but body is invalid JSON", async () => {
    configure();
    const req = new NextRequest("http://localhost/api/model3d", {
      method: "POST",
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("imageDataUrl 필요");
  });

  it("returns 502 when the provider fails", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const req = new NextRequest("http://localhost/api/model3d", {
      method: "POST",
      body: JSON.stringify({ imageDataUrl: "data:image/jpeg;base64,x" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("boom");
    vi.unstubAllGlobals();
  });

  it("returns 413 when content-length header exceeds the cap", async () => {
    configure();
    const req = new NextRequest("http://localhost/api/model3d", {
      method: "POST",
      headers: { "content-length": "13000000", "x-forwarded-for": "203.0.113.10" },
      body: JSON.stringify({ imageDataUrl: "data:image/jpeg;base64,x" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("이미지가 너무 커요");
  });

  it("returns 429 after exceeding the per-IP rate limit", async () => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ result: "task-1" }) }),
    );
    const ip = "198.51.100.42";
    let last: Response | undefined;
    for (let i = 0; i < 11; i++) {
      const req = new NextRequest("http://localhost/api/model3d", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: JSON.stringify({ imageDataUrl: "data:image/jpeg;base64,x" }),
      });
      last = await POST(req);
    }
    expect(last!.status).toBe(429);
    expect((await last!.json()).error).toBe("요청이 너무 많아요. 잠시 후 다시 시도해 주세요.");
    vi.unstubAllGlobals();
  });
});

describe("GET /api/model3d", () => {
  it("returns 503 when unconfigured", async () => {
    unconfigure();
    const req = new NextRequest("http://localhost/api/model3d");
    const res = await GET(req);
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("MESHY_API_KEY 미설정");
  });

  it("returns 400 when configured but taskId missing", async () => {
    configure();
    const req = new NextRequest("http://localhost/api/model3d");
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("taskId 필요");
  });

  it("returns 502 when the provider fails", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const req = new NextRequest("http://localhost/api/model3d?taskId=t1");
    const res = await GET(req);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("boom");
    vi.unstubAllGlobals();
  });
});
