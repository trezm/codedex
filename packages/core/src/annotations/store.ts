import { Annotation, AnnotationFile } from "./types.js";

export interface FileSystem {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export class AnnotationStore {
  constructor(
    private sylDir: string,
    private fs: FileSystem
  ) {}

  private annotationPath(sourceFile: string): string {
    return `${this.sylDir}/${sourceFile}.json`;
  }

  async load(sourceFile: string): Promise<AnnotationFile> {
    const path = this.annotationPath(sourceFile);
    if (await this.fs.exists(path)) {
      const raw = await this.fs.readFile(path);
      return JSON.parse(raw) as AnnotationFile;
    }
    return { version: 1, sourceFile, annotations: {} };
  }

  private async save(
    sourceFile: string,
    file: AnnotationFile
  ): Promise<void> {
    const path = this.annotationPath(sourceFile);
    const dir = path.substring(0, path.lastIndexOf("/"));
    await this.fs.mkdir(dir);
    await this.fs.writeFile(path, JSON.stringify(file, null, 2));
  }

  async add(
    sourceFile: string,
    semanticPath: string,
    body: string,
    author: string
  ): Promise<Annotation> {
    const file = await this.load(sourceFile);
    const now = new Date().toISOString();
    const annotation: Annotation = {
      id: generateId(),
      body,
      author,
      created: now,
      updated: now,
    };
    if (!file.annotations[semanticPath]) {
      file.annotations[semanticPath] = [];
    }
    file.annotations[semanticPath].push(annotation);
    await this.save(sourceFile, file);
    return annotation;
  }

  async update(
    sourceFile: string,
    semanticPath: string,
    annotationId: string,
    body: string
  ): Promise<Annotation | null> {
    const file = await this.load(sourceFile);
    const list = file.annotations[semanticPath];
    if (!list) return null;
    const annotation = list.find((a) => a.id === annotationId);
    if (!annotation) return null;
    annotation.body = body;
    annotation.updated = new Date().toISOString();
    await this.save(sourceFile, file);
    return annotation;
  }

  async remove(
    sourceFile: string,
    semanticPath: string,
    annotationId: string
  ): Promise<boolean> {
    const file = await this.load(sourceFile);
    const list = file.annotations[semanticPath];
    if (!list) return false;
    const idx = list.findIndex((a) => a.id === annotationId);
    if (idx === -1) return false;
    list.splice(idx, 1);
    if (list.length === 0) {
      delete file.annotations[semanticPath];
    }
    await this.save(sourceFile, file);
    return true;
  }

  async listPaths(sourceFile: string): Promise<string[]> {
    const file = await this.load(sourceFile);
    return Object.keys(file.annotations);
  }

  async getForPath(
    sourceFile: string,
    semanticPath: string
  ): Promise<Annotation[]> {
    const file = await this.load(sourceFile);
    return file.annotations[semanticPath] ?? [];
  }
}
