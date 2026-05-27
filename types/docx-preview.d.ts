declare module 'docx-preview' {
  export function renderAsync(
    blob: Blob | ArrayBuffer | string,
    container: HTMLElement,
    styleContainer?: HTMLElement,
    options?: any
  ): Promise<void>

  export function render(
    blob: Blob | ArrayBuffer | string,
    container: HTMLElement,
    styleContainer?: HTMLElement,
    options?: any
  ): void

  const _default: any
  export default _default
}
