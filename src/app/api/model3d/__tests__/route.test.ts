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
