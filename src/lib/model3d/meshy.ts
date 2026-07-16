import type { Image3DProvider, Model3DTask } from "./provider";

const BASE = "https://api.meshy.ai/openapi/v1/image-to-3d";

export function mapMeshyStatus(status: string): Model3DTask["status"] {
  if (status === "PENDING" || status === "IN_PROGRESS") return "pending";
  if (status === "SUCCEEDED") return "succeeded";
  return "failed";
}

export class MeshyProvider implements Image3DProvider {
  id = "meshy";

  constructor(
    private apiKey: string,
    private fetchFn: typeof fetch = fetch,
  ) {}

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private headers() {
    return { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" };
  }

  async createTask(imageDataUrl: string): Promise<string> {
    const res = await this.fetchFn(BASE, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ image_url: imageDataUrl, enable_pbr: false }),
    });
    if (!res.ok) throw new Error(`Meshy create failed: ${res.status}`);
    const data = (await res.json()) as { result: string };
    return data.result;
  }

  async getTask(taskId: string): Promise<Model3DTask> {
    const res = await this.fetchFn(`${BASE}/${encodeURIComponent(taskId)}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Meshy get failed: ${res.status}`);
    const data = (await res.json()) as {
      status: string;
      model_urls?: { glb?: string };
      task_error?: { message?: string };
    };
    const status = mapMeshyStatus(data.status);
    if (status === "succeeded") return { status, modelUrl: data.model_urls?.glb };
    if (status === "failed") return { status, error: data.task_error?.message ?? "생성 실패" };
    return { status };
  }
}

export function getModel3DProvider(): Image3DProvider {
  return new MeshyProvider(process.env.MESHY_API_KEY ?? "");
}
