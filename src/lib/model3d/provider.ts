export interface Model3DTask {
  status: "pending" | "succeeded" | "failed";
  modelUrl?: string;
  error?: string;
}

/** 사진 → 3D 메시 생성 서비스 어댑터. 구현체 교체 가능(Meshy, Tripo 등). */
export interface Image3DProvider {
  id: string;
  isConfigured(): boolean;
  /** 태스크 생성 → task id */
  createTask(imageDataUrl: string): Promise<string>;
  getTask(taskId: string): Promise<Model3DTask>;
}
