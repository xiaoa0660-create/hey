import type { Capture } from "../domain/session";
import type { Photo } from "../lib/types";
import type { NotebookTarget } from "./experience";
import { canvasBlob, photoCanvas, trackUrl } from "../lib/images";

type StoredPhoto = { metadata: Omit<Photo, "url">; blob: Blob };
export type SavedCard = {
  id: string;
  title: string;
  updated: number;
  templateId?: string;
  reference: StoredPhoto;
  target: NotebookTarget;
  capture?: {
    metadata: Omit<Capture, "photo">;
    photo: StoredPhoto;
    target: NotebookTarget;
  };
};
const DB = "zhaozhepai-notebook-v1";
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("cards", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("浏览器未允许本地保存，请检查是否处于受限或隐私模式。"));
    request.onblocked = () =>
      reject(new Error("请关闭另一个照着拍页面后重试。"));
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cards", mode);
    const request = action(tx.objectStore("cards"));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(new Error("保存未完成，可能是浏览器存储空间不足。请先导出原片。"));
    };
  });
}
async function pack(photo: Photo): Promise<StoredPhoto> {
  const aspect =
    (photo.width * photo.crop.width) / (photo.height * photo.crop.height);
  const canvas = await photoCanvas(photo, 1600 * Math.min(1, aspect));
  const { url: _url, ...metadata } = photo;
  return {
    metadata: {
      ...metadata,
      width: canvas.width,
      height: canvas.height,
      crop: { x: 0, y: 0, width: 1, height: 1 },
    },
    blob: await canvasBlob(canvas, "image/jpeg", 0.92),
  };
}
function unpack(photo: StoredPhoto): Photo {
  return { ...photo.metadata, url: trackUrl(photo.blob) };
}
export const listCards = () =>
  transaction("readonly", (store) => store.getAll() as IDBRequest<SavedCard[]>);
export const deleteCard = (id: string) =>
  transaction("readwrite", (store) => store.delete(id));
export async function saveCard(
  reference: Photo,
  target: NotebookTarget,
  templateId?: string,
  capture?: Capture,
) {
  const id = `card-${reference.id}`;
  const existing = await transaction(
    "readonly",
    (store) => store.get(id) as IDBRequest<SavedCard | undefined>,
  );
  // The limit is checked in the same write transaction as the write, including across tabs.
  const captureMetadata = capture
    ? (({ photo: _photo, ...metadata }) => metadata)(capture)
    : undefined;
  const card: SavedCard = {
    id,
    title: reference.name,
    updated: Date.now(),
    templateId,
    reference: await pack(reference),
    target,
    capture: capture
      ? { metadata: captureMetadata!, photo: await pack(capture.photo), target }
      : existing?.capture,
  };
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("cards", "readwrite"),
      store = tx.objectStore("cards");
    let limit = false;
    const count = store.getAllKeys();
    count.onsuccess = () => {
      if (count.result.length >= 12 && !count.result.includes(id)) {
        limit = true;
        tx.abort();
        return;
      }
      store.put(card);
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(
        new Error(
          limit
            ? "已保存 12 张小卡，请先删除一张再保存。"
            : "本地保存失败，可能是空间不足。请先导出照片。",
        ),
      );
    };
  });
  return card;
}
export function restoreCard(card: SavedCard) {
  return {
    reference: unpack(card.reference),
    target: card.target,
    captureTarget: card.capture?.target ?? card.target,
    capture: card.capture
      ? ({
          ...card.capture.metadata,
          photo: unpack(card.capture.photo),
        } as Capture)
      : null,
  };
}
