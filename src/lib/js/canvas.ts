import { fabric } from 'fabric'
import { objectLock } from '$lib/js/control'
import { canvasElement } from '$src/store/canvas'
import type { CustomCanvas } from '$src/types/canvas'
import type { DrawingOptionType, ZoomOptions } from '$src/types/canvas'

// 캔버스 전체적인 세팅에 대한 변경을 담당
class drag {
  // 드래그 모드
  canvas: CustomCanvas // 캔버스
  dragMode = false // 드래그모드 여부
  isDragging = false // 드래그중인가?
  clientX = 0
  clientY = 0

  constructor(canvas: CustomCanvas) {
    this.canvas = canvas
  }
  startDrag () {
    // 드래그 시작
    objectLock(this.canvas, {isLock: true})
    this.canvas.defaultCursor = 'move'
    this.canvas.selection = false
    this.dragMode = true
  }

  endDrag () {
    // 드래그 종료
    objectLock(this.canvas, {isLock: false})
    this.canvas.defaultCursor = 'default'
    this.canvas.selection = true
    this.dragMode = false
    // viewport를 리셋해준다
    this.canvas.viewportTransform = [1, 0, 0, 1, 0, 1]
  }

  setPosition (options: fabric.IEvent<MouseEvent>) {
    this.isDragging = true
    // 마지막 위치를 저장
    this.clientX = options.e.clientX
    this.clientY = options.e.clientY
  }

  dragging (options: fabric.IEvent<MouseEvent>) {
    if (this.isDragging && options) {
      // 모든 객체 선택종료
      this.canvas.selection = false

      // 이동할 거리
      let moveX = 0
      let moveY = 0
      // 현재 이벤트 위치에서 마지막 거리를 차감
      if (this.clientX) moveX = options.e.clientX - this.clientX
      if (this.clientY) moveY = options.e.clientY - this.clientY
      
      // 마지막 위치 다시저장
      this.clientX = options.e.clientX
      this.clientY = options.e.clientY
      // 이동할 포인트 지정
      let delta = new fabric.Point(moveX, moveY)
      // viewpoint 포인트만큼 옮겨주기
      this.canvas.relativePan(delta)
    }
  }
}

async function loadImage(canvas: CustomCanvas, image: File) {
  const event = await fileLoad(image)
  // const event = await fileLoad(new File(['0', '1'], 'test')) as ProgressEvent<FileReader>
  // 파일로드 완료시 기존내용 초기화
  canvas.clear()
  canvas.imagePath = ''

  canvas.imagePath = image.name

  const imgObj = new Image()
  if (event.target?.result && typeof event.target?.result == 'string') {
    imgObj.src = event.target.result
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    imgObj.onload = async () => {
      const img = new fabric.Image(imgObj)
      if (img.width && img.height) {
        // 이미지 크기가 있다면
        if (canvas.width && canvas.height) {
          // 이미지는 기본 중앙에 위치하도록
          img.set({
            left: canvas.width / 2,
            top: canvas.height / 2,
          })
        }

        // 캔버스 element의 크기가 너무 크지않게 조정(내부 이미지 사이즈는 원본유지하기위함)
        canvasResize(canvas, img.width, img.height)
      }

      canvas.centerObject(img)
      canvas.add(img);
        
      const object = canvas.getObjects().find(x => x.type == 'image')
      if (object) {
        object.set({ hasBorders: false, hasControls: false, selectable: false, hoverCursor: 'default' })
        canvas.requestRenderAll()
        resolve(imgObj)
      }
    }
    imgObj.onerror = error => {
      reject(error)
    }
  })
}

async function fileLoad(file: File) {
  return new Promise<ProgressEvent<FileReader>>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (event) => resolve(event)
    reader.onerror = (error) => reject(error)
    reader.readAsDataURL(file)
  })
}

function canvasResize (canvas: CustomCanvas, w:number, h:number) {
  canvas.imageSize = {
    width: w,
    height: h,
  }
  let width = 0
  let height = 0
  if ((w >= 1280 || h >= 720)) {
    // 둘중 하나가 1280 720보다 높은경우
    if (w > h) {
      // 가로가 더 넓은경우
      width = 1280
      height = h / (w / 1280)
      canvas.cornerSize = 15 * w / 1280
    } else {
      // 세로가 더 넓은경우
      width = w / (h / 720)
      height = 720
      canvas.cornerSize = 15 * h / 720
    }
  } else {
    width = w
    height = h
    canvas.cornerSize = 15
  }

  canvas.setWidth(w)
  canvas.setHeight(h)
  canvasMaxWidth(width, height)
}

function canvasMaxWidth (width:number, height: number) {
  // 캔버스 element의 크기가 너무 크지않게 조정(내부 이미지 사이즈는 원본유지하기위함)
  (document.querySelector('.lower-canvas') as HTMLCanvasElement).style.maxWidth = width + 'px';
  (document.querySelector('.lower-canvas') as HTMLCanvasElement).style.maxHeight = height + 'px';
  (document.querySelector('.upper-canvas') as HTMLCanvasElement).style.maxWidth = width + 'px';
  (document.querySelector('.upper-canvas') as HTMLCanvasElement).style.maxHeight = height + 'px';
  (document.querySelector('.canvas-container') as HTMLDivElement).style.maxWidth = width + 'px';
  (document.querySelector('.canvas-container') as HTMLDivElement).style.maxHeight = height + 'px';
  canvasElement.update(state => state)
}

function Zoom (canvas: CustomCanvas, {options, isZoomIn}: ZoomOptions) {
  // 화면 줌
  let zoom = 0

  // 줌 지점 default는 center
  let offsetX = (canvas.width ?? 0) / 2
  let offsetY = (canvas.height ?? 0) / 2
  if(options) {
    // wheel 음수일경우 줌 양수일경우 줌아웃 천천히 줌되고 빨리 아웃되게함
    zoom = canvas.getZoom() - (options?.e.deltaY > 0 ? 1 : -1) / 10
    offsetX = options.e.offsetX
    offsetY = options.e.offsetY
  } else {
    // 메뉴얼로 줌 인 아웃을 조절 고정값으로 동작하게함
    zoom = canvas.getZoom() - (isZoomIn ? 0.1 : -0.1)
  }
  
  if (zoom > 15) zoom = 15 // 15배율이 넘어가면 정지
  if (zoom < 1) zoom = 1 // 최대 1까지만 가능하게함(그 이상은 안보임)

  // viewport를 벗어나지 않게하자
  canvas.viewportTransform = [1, 0, 0, 1, 0, 1]

  // 휠을 동작시킨 포인터 위치에 줌 in&out
  canvas.zoomToPoint({
    x: offsetX,
    y: offsetY
  }, zoom)
  canvas.requestRenderAll()
}

function setVariable () {
  // 캔버스 오브젝트 기본설정
  return {
    strokeWidth: 1, // 선굵기
    strokeTransparent: false, // 선채우기 없음 여부
    stroke: '#000000', // 선 컬러
    fillTransparent: false, // 색채우기 없음여부
    fill: '#ffffff', // 색 컬러
    fontSize: 18, // 폰트사이즈
    isBold: false, // 볼드여부
  } as DrawingOptionType
}

function downLoadImage(canvas: CustomCanvas) {
  const path = canvas.imagePath ? canvas.imagePath : 'sample.png'
  const link = document.createElement('a')
  link.href = canvas.toDataURL({
    format: path.substring(path.lastIndexOf('.')).replace('.', '')
  })
  link.download = path
  link.click()
  link.remove()
}

export {
  drag,
  loadImage,
  canvasResize,
  canvasMaxWidth,
  setVariable,
  downLoadImage,
  Zoom
}