import { XRSpace, useXRInputSourceState } from '@react-three/xr'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { RefObject } from 'react'

const floor_border = 1.2

type LaserPointerProps = {
  interactablesRef: RefObject<Map<string, THREE.Object3D | null>>
  onHover: (id: string | null) => void
  maxDistance?: number
}

// огромная мучительная функция для луча, перемещения с помощью луча
export function LaserPointer({ interactablesRef, onHover, maxDistance = 10 }: LaserPointerProps) {
  const controller = useXRInputSourceState('controller', 'right')
  const raySpaceRef = useRef<THREE.Object3D | null>(null)
  const markerRef = useRef<THREE.Mesh | null>(null)


  const grabbedIdRef = useRef<string | null>(null)
  const grabbedDistRef = useRef<number>(0)
  const grabbedLocalPointRef = useRef<THREE.Vector3 | null>(null)
  const triggerPressedRef = useRef(false)

  const stickDeadzone = 0.15
  const rotSpeed = 2.2

  //сущности из three для сборки обновляющегося луча
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const origin = useMemo(() => new THREE.Vector3(), [])
  const dir = useMemo(() => new THREE.Vector3(), [])
  const quat = useMemo(() => new THREE.Quaternion(), [])

  //стейт предыдущего наведения
  const prevHoverRef = useRef<string | null>(null)

  
  //временные вектора для расчётов
  const tmpVecA = useMemo(() => new THREE.Vector3(), [])
  const tmpVecB = useMemo(() => new THREE.Vector3(), [])
  const tmpQuatA = useMemo(() => new THREE.Quaternion(), [])
  const tmpScaleA = useMemo(() => new THREE.Vector3(), [])


  //создание геометрии для луча (две точки по 3 координаты - массив из 6 чисел)
  const linePositions = useMemo(() => new Float32Array(6), [])
  const lineGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
    return g
  }, [linePositions])


  // главный цикл, который выполняется каждый кадр
  useFrame((_, delta) => {
    if (!controller || !raySpaceRef.current) return

    //луч: получаем world позицию и направление луча из пространства контроллера
    raySpaceRef.current.getWorldPosition(origin)
    raySpaceRef.current.getWorldQuaternion(quat)
    dir.set(0, 0, -1).applyQuaternion(quat).normalize()

    //собираем все объекты, с которыми можно взаимодействовать из рефа
    const targets: THREE.Object3D[] = []
    for (const obj of interactablesRef.current.values()) if (obj) targets.push(obj)

    // пересечение луча с объектами, используя Three.js Raycaster
    raycaster.far = maxDistance
    raycaster.set(origin, dir)
    const hit = (
      raycaster.intersectObjects as unknown as (objects: unknown[], recursive?: boolean) => THREE.Intersection[]
    )(targets as unknown as unknown[], true)[0]

    // если луч ни с чем не пересёкся, то hit будет undefined, поэтому используем тернарник для безопасного доступа к свойствам
    const hitDist = hit ? hit.distance : maxDistance
    const hitPointWorld = hit?.point ?? null
    const hoveredId = hit?.object?.userData?.id ?? null
    const hoveredKind = hit?.object?.userData?.kind ?? null

    //наведение: если id объекта под лучом изменилось, то вызываем колбек onHover с новым id 
    if (prevHoverRef.current !== hoveredId) {
      prevHoverRef.current = hoveredId
      onHover(hoveredId)
      if (hoveredId) console.log(hoveredKind)
    }

    // доступ к кнопкам геймпада (контроллера шлема)
    const gp = controller.inputSource.gamepad
    const pressed = !!gp && gp.buttons.length > 0 && gp.buttons[0].pressed

    // нажали
    if (pressed && !triggerPressedRef.current) {
      triggerPressedRef.current = true

      if (hoveredId && hitPointWorld) {
        const obj = interactablesRef.current.get(hoveredId)
        // сохраняем в рефах id захваченного объекта, расстояние до него и локальную точку захвата (чтобы при перемещении объект не прыгал, а сохранял позицию относительно луча)
        if (obj) {
          grabbedIdRef.current = hoveredId
          grabbedDistRef.current = hitDist
          grabbedLocalPointRef.current = obj.worldToLocal(hitPointWorld.clone())
        }
      }
    }

    // отпустили
    if (!pressed && triggerPressedRef.current) {
      triggerPressedRef.current = false
      grabbedIdRef.current = null
      grabbedLocalPointRef.current = null
    }

    // отрисовка луча от origin до hitPointWorld (или maxDistance)
    linePositions[0] = origin.x
    linePositions[1] = origin.y
    linePositions[2] = origin.z

    linePositions[3] = origin.x + dir.x * hitDist
    linePositions[4] = origin.y + dir.y * hitDist
    linePositions[5] = origin.z + dir.z * hitDist

    lineGeom.attributes.position.needsUpdate = true
    markerRef.current?.position.set(linePositions[3], linePositions[4], linePositions[5])

    // если что-то захвачено, то перемещаем его к точке на луче, которая находится на расстоянии grabbedDist от origin 
    const grabbedId = grabbedIdRef.current
    const grabbedLocalPoint = grabbedLocalPointRef.current

    if (grabbedId && grabbedLocalPoint) {
      const obj = interactablesRef.current.get(grabbedId)
      if (!obj || !obj.parent) return

      const desiredWorldPoint = tmpVecA.set(
        origin.x + dir.x * grabbedDistRef.current,
        origin.y + dir.y * grabbedDistRef.current,
        origin.z + dir.z * grabbedDistRef.current
      )

      // учёт начального смещения захвата
      obj.getWorldQuaternion(tmpQuatA)
      obj.getWorldScale(tmpScaleA)

      const worldOffset = tmpVecB.copy(grabbedLocalPoint).multiply(tmpScaleA).applyQuaternion(tmpQuatA)

      const newWorldPos = desiredWorldPoint.sub(worldOffset)

      // ограничение по полу, чтобы не проваливать объекты под текстурки
      newWorldPos.y = Math.max(newWorldPos.y, floor_border)

      obj.position.copy(obj.parent.worldToLocal(newWorldPos))

      // вращение стиком по горизонтали (вертикально закомментил, выглядит не очень) 
      if (gp && gp.axes && gp.axes.length >= 2) {
        const ax = gp.axes.length >= 4 ? gp.axes[2] : gp.axes[0]
        // const ay = gp.axes.length >= 4 ? gp.axes[3] : gp.axes[1]

        const dx = Math.abs(ax) > stickDeadzone ? ax : 0
        // const dy = Math.abs(ay) > stickDeadzone ? ay : 0

        obj.rotation.y += dx * rotSpeed * delta
        // obj.rotation.x += -dy * rotSpeed * delta
      }
    }
  })

  if (!controller) return null

  return (
    <>
      <XRSpace ref={raySpaceRef} space={controller.inputSource.targetRaySpace} />
      {/* <line geometry={lineGeom}>
        <lineBasicMaterial color="purple" />
      </line> */}
      <primitive object={new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 'purple' }))} />

      <mesh ref={markerRef}>
        <sphereGeometry args={[0.045, 12, 12]} />
        <meshBasicMaterial color="red" />
      </mesh>
    </>
  )
}

//компонент для отработки кнопок (по X удаляется предмет, на которвый навели)
export function ControllerShortcuts({
  hoveredId,
  onDelete,
}: {
  hoveredId: string | null
  onDelete: (id: string) => void
}) {
  const left = useXRInputSourceState('controller', 'left')
  const prevXPressed = useRef(false)

  useFrame(() => {
    if (!left) return
    const gp = left.inputSource.gamepad
    if (!gp || gp.buttons.length === 0) return

    const xPressed = !!gp.buttons[4]?.pressed // в IWE кнопка X

    if (xPressed && !prevXPressed.current) {
      prevXPressed.current = true
      if (hoveredId) onDelete(hoveredId)
    }

    if (!xPressed && prevXPressed.current) {
      prevXPressed.current = false
    }
  })

  return null
}


//компонент для спавна объектов перед камерой при нажатии кнопки в инфопанели "Добавить объект"
//переменная spawnTick увеличивается +1 при нажатии кнопки, реагируем при изменении
export function Spawner({
  spawnTick,
  onSpawn,
}: {
  spawnTick: number
  onSpawn: (pos: [number, number, number]) => void
}) {
  const { camera } = useThree()
  const lastTick = useRef(spawnTick)

  const vForward = useMemo(() => new THREE.Vector3(), [])
  const vRight = useMemo(() => new THREE.Vector3(), [])
  const vUp = useMemo(() => new THREE.Vector3(), [])
  const vPos = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (lastTick.current === spawnTick) return
    lastTick.current = spawnTick

    const dist = 2.5
    const offR = (Math.random() - 0.5) * 1.0 // +- 0.5м
    const offU = (Math.random() - 0.5) * 0.6 // +- 0.3м

    vForward.set(0, 0, -1).applyQuaternion(camera.quaternion)
    vRight.set(1, 0, 0).applyQuaternion(camera.quaternion)
    vUp.set(0, 1, 0).applyQuaternion(camera.quaternion)

    vPos
      .copy(camera.position)
      .add(vForward.multiplyScalar(dist))
      .add(vRight.multiplyScalar(offR))
      .add(vUp.multiplyScalar(offU))


    vPos.y = Math.max(vPos.y, floor_border)

    // вызывает колбэк спавна: генерируется новый айди, выбирается случайный тип объекта и спавнится в точке vPos перед камерой
    onSpawn([vPos.x, vPos.y, vPos.z])
  })

  return null
}
