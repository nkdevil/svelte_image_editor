import type { CustomCanvas } from '$src/types/canvas'
import type { DrawingOptionType, Color } from '$src/types/canvas'
import { canvasElement } from '$src/store/canvas'
import { history } from '$lib/js/canvas'

class control {
  history: history
  canvas: CustomCanvas // 캔버스
  clipBoard: fabric.ActiveSelection | null = null

  constructor(canvas: CustomCanvas) {
    this.canvas = canvas
    this.history = new history(this.canvas)
  }

  copy () {
    const target = this.canvas.getActiveObject()
    if (target) {
      target.clone((cloned: fabric.ActiveSelection) => {
        this.clipBoard = cloned
      })
    }
  }

  paste() {
    if (this.clipBoard) {
      this.clipBoard.clone((cloned: fabric.ActiveSelection) => {
        this.canvas.discardActiveObject()
        // 위치 재조정
        cloned.set({
          left: cloned.left ?? 0 + 10,
          top: cloned.top ?? 0 + 10,
          evented: true,
        })
        if (cloned.type === 'activeSelection') {
          // 대상이 다수선택인경우
          cloned.canvas = this.canvas
          cloned.forEachObject((obj: fabric.Object) => {
            this.canvas.add(obj)
          })
          cloned.setCoords()
        } else {
          this.canvas.add(cloned)
        }
        // 생성한 대상 선택후 재 랜더링
        this.canvas.setActiveObject(cloned)
        if (cloned.top && cloned.left) {
          cloned.top = cloned.top + 10
          cloned.left =  cloned.left + 10
        }
        this.clipBoard = cloned
      })
      this.history.saveData('paste')
      canvasElement.update(state => state)
      this.canvas.requestRenderAll()
    }
  }
}

// 캔버스 내부 오브젝트에 대한 컨트롤을 담당
function objectLock(canvas: CustomCanvas, {isLock}: {isLock?: boolean}) {
  // isLock = true면 잠금 false면 해제
  canvas.discardActiveObject()
  canvas.forEachObject((o) => {
    if (o.type != 'image') {
      // 이미지는 항상 제외
      o.hasBorders = o.hasControls = o.selectable = !isLock
      o.hoverCursor = isLock ? 'default' :'move'
    }
  })
  canvasElement.update(state => state)
  canvas.requestRenderAll()
}

function setCanvasObject (canvas: CustomCanvas, strokeWidth: number, color: Color, target: 'strokeWidth'|'stroke'|'fill') {
  // object 옵션 변경 (색깔, 두께, 글씨 컨트롤)
  const activeObjects = canvas.getActiveObjects()
  if(activeObjects.length > 0) {
    activeObjects.forEach((obj) => {
      if (target == 'strokeWidth') {
        obj.set('strokeWidth', strokeWidth)
      } else if (target == 'stroke') {
        obj.set('stroke', color.stroke)
      } else {
        obj.set('fill', color.fill)
      }
      canvas.requestRenderAll()
    })
  }
  if (canvas.isDrawingMode) {
    // 드로잉모드가 켜져있다면 옵션적용
    canvas.freeDrawingBrush.color = color.stroke
    canvas.freeDrawingBrush.width = strokeWidth
  }
}

function setCanvasText (canvas: CustomCanvas, fontSize: number, isBold: boolean) {
  const activeObjects = canvas.getActiveObjects()
  if(activeObjects.length > 0) {
    activeObjects.forEach((obj) => {
      if (obj.type == 'i-text') {
        // 텍스트인 경우만
        let object = obj as fabric.Text
        object.set('fontSize', fontSize)
        object.set('fontWeight', isBold ? 'bold' : '')
        canvas.requestRenderAll()
      }
    })
  }
}

function deleteActiveObjects(canvas: CustomCanvas) {
  // 선택된 오브젝트 전체삭제
  const activeObjects = canvas.getActiveObjects()
  if(activeObjects.length > 0) {
    activeObjects.forEach((obj) => {
      canvas.remove(obj)
    })
  }
  canvas.discardActiveObject().requestRenderAll()
  canvasElement.update(state => state)
  new history(canvas).saveData('delete')
}

function sendToBack (canvas: CustomCanvas) {
  // 뒤로보내기
  const activeObjects = canvas.getActiveObjects()
  if(activeObjects.length) {
    activeObjects.forEach((obj) => {
      canvas.sendBackwards(obj)
    })
  }
  canvasElement.update(state => state)
}

function bringToFront (canvas: CustomCanvas) {
  // 앞으로보내기
  const activeObjects = canvas.getActiveObjects()
  if(activeObjects.length > 0) {
    activeObjects.forEach((obj) => {
      canvas.bringForward(obj)
    })
  }
  canvasElement.update(state => state)
}

function copyObject (canvas: CustomCanvas) {
  // 선택된 객체 복사하기
  const activeObjects = canvas.getActiveObjects()
  if (activeObjects.length > 0) {
    canvas.getActiveObject()?.clone((cloned: fabric.ActiveSelection) => {
      if (cloned) {
        canvas.discardActiveObject()
        // 대상의 위치 재조정
        cloned.set({
          left: cloned.left ?? 0 + 10,
          top: cloned.top ?? 0 + 10,
          evented: true,
        })
        if (cloned.type === 'activeSelection') {
          // 대상이 다수선택인경우
          cloned.canvas = canvas
          cloned.forEachObject((obj: fabric.Object) => {
            canvas.add(obj)
          })
          cloned.setCoords()
        } else {
          canvas.add(cloned)
        }
        new history(canvas).saveData('paste')
        if (cloned.top && cloned.left) {
          cloned.top += 10
          cloned.left += 10
        }
        // 생성한 대상 선택후 재 랜더링
        canvas.setActiveObject(cloned)
        canvas.requestRenderAll()
      }
    })
  }
}

function updateVariable(e: fabric.IEvent, variable: DrawingOptionType) {
  // canvas가 선택된경우 부모에게서 할당
  const result = variable
  if (e.selected) {
    // 선택된 값이 있는경우
    if (e.selected.length == 1) {
      // 한개만 선택된경우
      if (e.selected[0].stroke) {
        if (e.selected[0].stroke == 'transparent') {
          result.strokeTransparent = true
        } else {
          result.strokeTransparent = false
          result.stroke = e.selected[0].stroke
        }
      }
      if (e.selected[0].strokeWidth) {
        result.strokeWidth = e.selected[0].strokeWidth
      }
      if (e.selected[0].fill && typeof e.selected[0].fill == 'string' && e.selected[0].type != 'image') {
        if (e.selected[0].fill == 'transparent') {
          result.fillTransparent = true
        } else {
          result.fillTransparent = false
          result.fill = e.selected[0].fill
        }
      }
    }
    for (let i=0; i<e.selected.length; i++) {
      if (e.selected[i].type == 'i-text') {
        // 텍스트인 경우만 반영
        let object = e.selected[i] as fabric.Text
        if (object.fontSize) {
          result.fontSize = object.fontSize
        }
        result.isBold = object.fontWeight == 'bold' ? true : false
        break
      }
    }
  }
  return result
}

function group (canvas: CustomCanvas) {
  const target = canvas.getActiveObject() as fabric.ActiveSelection
  if (target && target.type === 'activeSelection') {
    target.toGroup()
    canvas.requestRenderAll()
    canvasElement.update(state => state)
  }
}

function unGroup (canvas: CustomCanvas) {
  const target = canvas.getActiveObject() as fabric.Group
  if (target && target.type === 'group') {
    target.toActiveSelection()
    canvas.requestRenderAll()
    canvasElement.update(state => state)
  }
}

export {
  control,
  objectLock,
  setCanvasObject,
  setCanvasText,
  deleteActiveObjects,
  sendToBack,
  bringToFront,
  copyObject,
  updateVariable,
  group,
  unGroup
}