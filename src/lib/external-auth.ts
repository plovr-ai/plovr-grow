import { NextRequest } from "next/server";

export type ExternalCaller = {
  authenticated: boolean;
  // 后续扩展：callerId, permissions, rateLimit 等
};

export async function validateExternalRequest(
  _request: NextRequest
): Promise<ExternalCaller> {
  // TODO: 实现 API key 校验
  // 1. 从 request header 取 API key (Authorization: Bearer <key>)
  // 2. 查数据库校验 key 是否有效
  // 3. 返回调用方身份信息
  return { authenticated: true };
}
