import { describe, it, expect, vi } from "vitest";
import { MeshyProvider, mapMeshyStatus } from "@/lib/model3d/meshy";

describe("mapMeshyStatus", () => {
  it("maps Meshy statuses to provider statuses", () => {
    expect(mapMeshyStatus("PENDING")).toBe("pending");
    expect(mapMeshyStatus("IN_PROGRESS")).toBe("pending");
    expect(mapMeshyStatus("SUCCEEDED")).toBe("succeeded");
    expect(mapMeshyStatus("FAILED")).toBe("failed");
    expect(mapMeshyStatus("CANCELED")).toBe("failed");
    expect(mapMeshyStatus("???")).toBe("failed");
  });
});

describe("MeshyProvider", () => {
  it("isConfigured reflects api key presence", () => {
    expect(new MeshyProvider("").isConfigured()).toBe(false);
    expect(new MeshyProvider("key").isConfigured()).toBe(true);
  });

  it("createTask posts image and returns task id", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: "task-123" }), { status: 200 }),
    );
    const p = new MeshyProvider("key", fetchFn);
    const id = await p.createTask("data:image/jpeg;base64,xx");
    expect(id).toBe("task-123");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toContain("/openapi/v1/image-to-3d");
    expect(init.headers.Authorization).toBe("Bearer key");
    expect(JSON.parse(init.body).image_url).toBe("data:image/jpeg;base64,xx");
  });

  it("getTask maps a succeeded task to the glb url", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ status: "SUCCEEDED", model_urls: { glb: "https://x/m.glb" } }),
        { status: 200 },
      ),
    );
    const p = new MeshyProvider("key", fetchFn);
    expect(await p.getTask("t1")).toEqual({ status: "succeeded", modelUrl: "https://x/m.glb" });
  });

  it("getTask surfaces failure message", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ status: "FAILED", task_error: { message: "bad image" } }),
        { status: 200 },
      ),
    );
    const p = new MeshyProvider("key", fetchFn);
    expect(await p.getTask("t1")).toEqual({ status: "failed", error: "bad image" });
  });

  it("createTask throws on non-2xx", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("nope", { status: 402 }));
    const p = new MeshyProvider("key", fetchFn);
    await expect(p.createTask("data:x")).rejects.toThrow(/402/);
  });
});
