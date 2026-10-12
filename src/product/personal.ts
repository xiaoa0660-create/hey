import type { Photo } from "../lib/types";
import { pack, type StoredPhoto } from "../notebook/storage";

export type PersonalCategory = "daily" | "checkin" | "painting";
export type PersonalReference = {
  id: string;
  name: string;
  category: PersonalCategory;
  updated: number;
  photo: StoredPhoto;
};
export const PERSONAL_CATEGORY_LABELS = {
  daily: "日常人像",
  checkin: "同款打卡",
  painting: "画作复刻",
};
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open("zhaozhepai-personal-references-v1", 1);
    } catch {
      reject(new Error("个人参考暂时无法保存，请检查浏览器存储权限。"));
      return;
    }
    request.onupgradeneeded = () =>
      request.result.createObjectStore("references", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = request.onblocked = () =>
      reject(new Error("个人参考暂时无法保存，请检查浏览器存储权限。"));
  });
}
async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("references", mode);
    const request = action(tx.objectStore("references"));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(new Error("个人参考未保存成功，请先保留原图后重试。"));
    };
  });
}
export async function listPersonalReferences() {
  return (
    await transact(
      "readonly",
      (store) => store.getAll() as IDBRequest<PersonalReference[]>,
    )
  ).sort((a, b) => b.updated - a.updated);
}
export const deletePersonalReference = (id: string) =>
  transact("readwrite", (store) => store.delete(id));
export async function putPersonalReference(record: PersonalReference) {
  if (!record.name.trim() || record.name.trim().length > 60)
    throw new Error("参考名称请填写 1–60 个字。");
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("references", "readwrite"),
      store = tx.objectStore("references");
    let limit = false;
    const keys = store.getAllKeys();
    keys.onsuccess = () => {
      if (keys.result.length >= 24 && !keys.result.includes(record.id)) {
        limit = true;
        tx.abort();
        return;
      }
      store.put({ ...record, name: record.name.trim(), updated: Date.now() });
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(
        new Error(
          limit
            ? "已保存 24 张个人参考，请在「我的参考」删除一张再上传。"
            : "个人参考未保存成功，请检查浏览器存储空间。",
        ),
      );
    };
  });
}
export async function savePersonalReference(
  photo: Photo,
  category: PersonalCategory,
) {
  const record: PersonalReference = {
    id: photo.id,
    name: photo.name.replace(/\.[^.]+$/, "").slice(0, 60) || "我的参考",
    category,
    updated: Date.now(),
    photo: await pack(photo),
  };
  await putPersonalReference(record);
  return record;
}
