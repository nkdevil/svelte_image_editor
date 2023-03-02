<script lang="ts">
  import { fabric } from 'fabric'
  import { onMount } from 'svelte'
  import { selectedComponent, canvasElement, shapeElement, drawingElement, dragElement, cropElement, resizeElement, filterElement } from '$src/store/canvas'
  import { loadImage, drag, Zoom, downLoadImage } from '$lib/js/canvas'
  import { deleteActiveObjects } from '$lib/js/control'
  import { shape } from '$lib/js/shape'
  import { draw } from '$lib/js/draw'
  import { crop } from '$lib/js/crop'
  import { resize } from '$lib/js/resize'
  import { filter } from '$lib/js/filter'

  import type { SvelteComponentTyped } from 'svelte'
  import type { CanvasOptionsUpdateComponent } from '$src/types/canvas'

  import defaultImage from '$lib/images/filter.png'

  import Controller from '$component/Controller.svelte'

  import Resize from '$component/canvasMenu/Resize.svelte'
  import Crop from '$component/canvasMenu/Crop.svelte'
  import Shape from '$component/canvasMenu/Shape.svelte'
  import Draw from '$component/canvasMenu/Draw.svelte'
  import Text from '$component/canvasMenu/Text.svelte'
  import Filp from '$component/canvasMenu/Flip.svelte'
  import Filter from '$component/canvasMenu/Filter.svelte'

  let ctx: HTMLCanvasElement // 캔버스 element

  $selectedComponent = {
    name: 'filter',
    component: Filter
  }

  let component: SvelteComponentTyped<Shape|Draw> // 컴포넌트 바인딩

  const selectorList = [
    {target: 'resize', component: Resize},
    {target: 'crop', component: Crop},
    {target: 'flip', component: Filp},
  //  {target: 'rotate', component: 'ROTATE'},
    {target: 'draw', component: Draw},
    {target: 'shape', component: Shape},
    {target: 'text', component: Text},
    {target: 'filter', component: Filter},
  ]

  let files: FileList
  let fileInput: HTMLInputElement

  // let fb = fabric

  onMount(() => {
    const fb = fabric
    // fb.textureSize = 4096
    fb.filterBackend = new fabric.Canvas2dFilterBackend()

    // 마운트시 캔버스 선언 및 remove 이벤트 리스너 추가하기
    canvasElement.set(new fb.Canvas(ctx))
    $canvasElement.on('selection:updated', setCanvasOption)
    $canvasElement.on('selection:created', setCanvasOption)

    drawingElement.set(new draw($canvasElement))
    dragElement.set(new drag($canvasElement))
    shapeElement.set(new shape($canvasElement))
    cropElement.set(new crop($canvasElement))
    resizeElement.set(new resize($canvasElement))
    filterElement.set(new filter())

    $canvasElement.on('mouse:down', (options) => {
      if ($drawingElement.polygonMode || $shapeElement.shapeMode || $canvasElement.isDrawingMode) {
        // 드로잉 시도중 드래그 꺼주기
        $dragElement.endDrag()
        dragElement.update(state => state)
      }
      if ($cropElement.cropMode) $cropElement.drawCrop(options) // crop object 그리기
      if ($drawingElement.polygonMode) component.mouseDown(options) // 폴리곤모드 시작
      if ($shapeElement.shapeMode) $shapeElement.drawShape(options) // 도형 그리기 시작
      if ($dragElement.dragMode) $dragElement.setPosition(options) // 드래그 포지션 감지
    })

    $canvasElement.on('mouse:up', () => {
      if ($cropElement.cropMode) $cropElement.endDrawing()// crop object 그리기
      if ($dragElement.dragMode) $dragElement.isDragging = false // 드래그중 끄기
      if ($shapeElement.shapeMode) { // 도형 그리기 시작
        $shapeElement.reset()
      }
    })

    $canvasElement.on('mouse:move', (options) => {
      if ($drawingElement.polygonMode) {
        // 폴리곤모드시 마우스 추적하여 랜더
        component.mouseMove(options)
      }
      if ($cropElement.cropMode) $cropElement.updateCrop(options) // crop 그리기시작
      if ($dragElement.isDragging) $dragElement.dragging(options) // 캔버스 드래그 감지
      if ($shapeElement.shapeMode) $shapeElement.updateShape(options) // 도형 그리기 시작
    })

    $canvasElement.on('mouse:wheel', (options) => {
      // 다른 이벤트가 없을때
      if (!$cropElement.cropMode && !$drawingElement.polygonMode && !$shapeElement.shapeMode && !$dragElement.dragMode && !$canvasElement.isDrawingMode)
      // 마우스 휠시 화면 줌
      Zoom($canvasElement, {options: options})
    })

    $canvasElement.on('object:scaling', () => {
      if ($cropElement.cropMode) $cropElement.updateCropScale() // crop 그리기시작
    })

    setDefaultimage()
    document.addEventListener('keydown', removeObjects)
    return () => document.removeEventListener('keydown', removeObjects)
  })

  async function setDefaultimage () {
    const response = await fetch(defaultImage)
    const data = await response.blob()
    try {
      const image = await loadImage($canvasElement, new File([data], 'earth', { type: data.type}))
      $filterElement.setImage($canvasElement)
    } catch (e) {
      console.error(e)
    }
  }

  function mountImage () {
    const file = files[0]
    if (file) {
      // 파일이 업로드 된 경우
      if (file.type.indexOf('image') > -1) {
        // 이미지인 경우만
        loadImage($canvasElement, file)
        fileInput.value = ''
      } else {
        fileInput.value = ''
        alert('이미지파일을 첨부해주세요')
      }
    }
  }

  function removeObjects (e: KeyboardEvent) {
    // 삭제버튼 클릭시 캔버스에서 선택된 요소 삭제하기
    e.key === 'Delete' && deleteActiveObjects($canvasElement)
  }

  function setCanvasOption (e: fabric.IEvent) {
    // 캔버스의 선택한 대상 옵션으로 업데이트
    if (component.setCanvasOption) {
      component.setCanvasOption(e) // 선택된경우 component 이벤트호출
    }
  }

  function changeComponent (t: string, c: CanvasOptionsUpdateComponent) {
    // 컴포넌트 변경시 클리어하기
    $selectedComponent = { name: t, component: c }
    $dragElement.endDrag()
  }

  function downLoad () {
    // 이미지 다운로드하기
    downLoadImage($canvasElement)
  }

</script>

<div class="editor">
  <section class="editor-header">
    <h1>IMAGE EDITOR</h1>
    <div class="editor-header-buttons">
      <label>
        Load Image
        <input 
          type="file"
          bind:files
          bind:this={fileInput}
          on:change={mountImage}/>
      </label>
      <button type="button" on:click={() => downLoad()}>DownLoad</button>
    </div>
  </section>
  <div class="editor-control-container">
    <Controller></Controller>
  </div>
  <div class="editor-canvas-container">
    <canvas bind:this={ctx} ></canvas>
  </div>
  <div class="editor-menu">
    <svelte:component this={$selectedComponent.component} bind:this={component}/>
    <ul class="editor-menu-list">
      {#each selectorList as item}
        <li>
          <button type="button"
            on:click={() => changeComponent(item.target, item.component)}
          >{item.target.toUpperCase()}</button>
        </li>
      {/each}
    </ul>
  </div>
</div>