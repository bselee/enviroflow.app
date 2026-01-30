# Integration Guide: Adding Connection Wires to Existing Pages

This guide shows how to add wire connections to EnviroFlow's existing controller and room pages.

## Quick Reference

**What you need:**
1. Import wrapper components
2. Wrap your layout with `ConnectionWireContainer`
3. Wrap controller card with `ControllerCardWrapper`
4. Wrap each device card with `DeviceCardWrapper`

**Time to integrate:** ~10 minutes per page

---

## Example 1: Controller Detail Page

**File:** `apps/web/src/app/controllers/[id]/page.tsx`

### Before (without wires):
```tsx
export default function ControllerDetailPage({ params }: Props) {
  const { controller, devices, loading } = useControllerWithDevices(params.id);

  return (
    <div className="container py-8">
      <ControllerCard controller={controller} />

      <div className="mt-8 grid grid-cols-3 gap-4">
        {devices.map(device => (
          <DeviceCard key={device.id} device={device} />
        ))}
      </div>
    </div>
  );
}
```

### After (with wires):
```tsx
import {
  ConnectionWireContainer,
  ControllerCardWrapper,
  DeviceCardWrapper,
} from '@/components/controllers/ConnectionWireContainer';

export default function ControllerDetailPage({ params }: Props) {
  const { controller, devices, loading } = useControllerWithDevices(params.id);

  if (loading) return <LoadingSkeleton />;

  return (
    <ConnectionWireContainer
      controllerId={params.id}
      className="container py-8"
    >
      {/* Controller Card - Wrapped */}
      <ControllerCardWrapper controllerId={params.id}>
        <ControllerCard controller={controller} />
      </ControllerCardWrapper>

      {/* Device Grid - Each device wrapped */}
      <div className="mt-8 grid grid-cols-3 gap-4">
        {devices.map(device => (
          <DeviceCardWrapper
            key={device.id}
            deviceId={device.id}
            controllerId={params.id}
            deviceType={device.device_type}
            isActive={device.current_state?.is_on ?? false}
          >
            <DeviceCard device={device} />
          </DeviceCardWrapper>
        ))}
      </div>
    </ConnectionWireContainer>
  );
}
```

**Changes made:**
1. ✅ Added 3 imports
2. ✅ Wrapped container with `ConnectionWireContainer`
3. ✅ Wrapped controller card with `ControllerCardWrapper`
4. ✅ Wrapped each device card with `DeviceCardWrapper`

---

## Example 2: Room Detail Page

**File:** `apps/web/src/app/rooms/[id]/page.tsx`

### Implementation:
```tsx
import {
  ConnectionWireContainer,
  ControllerCardWrapper,
  DeviceCardWrapper,
} from '@/components/controllers/ConnectionWireContainer';

export default function RoomDetailPage({ params }: Props) {
  const { room, controllers, devicesByController } = useRoom(params.id);

  return (
    <div className="container py-8">
      <h1>{room.name}</h1>

      {/* Each controller gets its own wire container */}
      {controllers.map(controller => {
        const devices = devicesByController[controller.id] || [];

        return (
          <ConnectionWireContainer
            key={controller.id}
            controllerId={controller.id}
            className="mb-16 pb-8 border-b"
          >
            {/* Controller */}
            <ControllerCardWrapper controllerId={controller.id}>
              <ControllerCard controller={controller} />
            </ControllerCardWrapper>

            {/* Devices */}
            <div className="mt-8 grid grid-cols-4 gap-4">
              {devices.map(device => (
                <DeviceCardWrapper
                  key={device.id}
                  deviceId={device.id}
                  controllerId={controller.id}
                  deviceType={device.device_type}
                  isActive={device.current_state?.is_on ?? false}
                >
                  <DeviceCard device={device} />
                </DeviceCardWrapper>
              ))}
            </div>
          </ConnectionWireContainer>
        );
      })}
    </div>
  );
}
```

**Key points:**
- ✅ Multiple `ConnectionWireContainer` instances (one per controller)
- ✅ Each container is isolated (wires don't cross between containers)
- ✅ Proper spacing between controller sections

---

## Example 3: Dashboard Widget

**File:** `apps/web/src/components/dashboard/ControllerStatusWidget.tsx`

### Implementation:
```tsx
import {
  ConnectionWireContainer,
  ControllerCardWrapper,
  DeviceCardWrapper,
} from '@/components/controllers/ConnectionWireContainer';

export function ControllerStatusWidget({ controllerId }: Props) {
  const { controller, devices } = useControllerWithDevices(controllerId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Controller Status</CardTitle>
      </CardHeader>
      <CardContent>
        <ConnectionWireContainer
          controllerId={controllerId}
          className="min-h-[400px]"
        >
          {/* Compact controller display */}
          <ControllerCardWrapper
            controllerId={controllerId}
            className="mb-6"
          >
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Badge variant={controller.status === 'online' ? 'default' : 'secondary'}>
                {controller.status}
              </Badge>
              <span className="font-semibold">{controller.name}</span>
            </div>
          </ControllerCardWrapper>

          {/* Compact device grid */}
          <div className="grid grid-cols-3 gap-2">
            {devices.slice(0, 6).map(device => (
              <DeviceCardWrapper
                key={device.id}
                deviceId={device.id}
                controllerId={controllerId}
                deviceType={device.device_type}
                isActive={device.current_state?.is_on ?? false}
              >
                <div className="p-2 border rounded text-center text-xs">
                  <p className="font-medium truncate">{device.name}</p>
                  <Badge
                    size="sm"
                    variant={device.current_state?.is_on ? 'default' : 'outline'}
                  >
                    {device.current_state?.is_on ? 'ON' : 'OFF'}
                  </Badge>
                </div>
              </DeviceCardWrapper>
            ))}
          </div>
        </ConnectionWireContainer>
      </CardContent>
    </Card>
  );
}
```

**Key points:**
- ✅ Works in constrained widget space
- ✅ Limit number of devices shown (slice first 6)
- ✅ Compact card styling
- ✅ Set minimum height for wire visibility

---

## Common Patterns

### Pattern 1: Loading States
```tsx
{loading ? (
  <div className="container py-8">
    <SkeletonCard />
    <SkeletonDeviceGrid />
  </div>
) : (
  <ConnectionWireContainer controllerId={controller.id}>
    {/* Your content */}
  </ConnectionWireContainer>
)}
```

**Why:** Don't render wire container until data is loaded to avoid position calculation errors.

### Pattern 2: Empty States
```tsx
<ConnectionWireContainer controllerId={controller.id}>
  <ControllerCardWrapper controllerId={controller.id}>
    <ControllerCard controller={controller} />
  </ControllerCardWrapper>

  {devices.length > 0 ? (
    <div className="grid grid-cols-3 gap-4">
      {devices.map(device => (
        <DeviceCardWrapper {...deviceProps}>
          <DeviceCard device={device} />
        </DeviceCardWrapper>
      ))}
    </div>
  ) : (
    <EmptyState message="No devices connected" />
  )}
</ConnectionWireContainer>
```

**Why:** Wire container handles empty device arrays gracefully (no wires rendered).

### Pattern 3: Conditional Wires (Feature Flag)
```tsx
const ENABLE_WIRES = true; // or from feature flag

return ENABLE_WIRES ? (
  <ConnectionWireContainer controllerId={controller.id}>
    {/* Wrapped content */}
  </ConnectionWireContainer>
) : (
  <div>
    {/* Unwrapped content */}
  </div>
);
```

**Why:** Easy A/B testing or gradual rollout.

---

## Type Safety

### Device Type Mapping
Ensure `device.device_type` matches one of the supported types:
```typescript
type DeviceType =
  | "fan"
  | "light"
  | "outlet"
  | "heater"
  | "cooler"
  | "humidifier"
  | "dehumidifier"
  | "pump"
  | "valve";
```

### Safe Active State
Always provide fallback for `is_on`:
```typescript
isActive={device.current_state?.is_on ?? false}
```

---

## Styling Tips

### 1. Container Spacing
```tsx
<ConnectionWireContainer
  controllerId={id}
  className="min-h-[600px] py-8" // Ensure enough space for wires
>
```

### 2. Controller Card Centering
```tsx
<ControllerCardWrapper controllerId={id} className="max-w-2xl mx-auto">
  <ControllerCard />
</ControllerCardWrapper>
```

### 3. Device Grid Layouts
```tsx
// Full width
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

// Constrained width
<div className="grid grid-cols-3 gap-4 max-w-4xl mx-auto">

// Compact
<div className="grid grid-cols-2 gap-2">
```

### 4. Responsive Design
```tsx
<ConnectionWireContainer
  controllerId={id}
  className="px-4 md:px-8 py-6 md:py-12" // More space on desktop
>
```

---

## Testing Checklist

After integrating wires into a page:

### Visual
- [ ] Wires appear connecting controller to all devices
- [ ] Wire colors match device types
- [ ] Active devices show colored wires with pulsing dots
- [ ] Inactive devices show gray wires
- [ ] No layout shifts or jumps during render

### Interaction
- [ ] Cards remain fully clickable
- [ ] Device toggles update wire colors smoothly
- [ ] Adding/removing devices updates wires

### Responsive
- [ ] Wires reposition on window resize
- [ ] Mobile layout doesn't show broken wires
- [ ] Wires adjust when toggling sidebar/panels

### Performance
- [ ] No console errors
- [ ] Smooth scrolling (60fps)
- [ ] Fast initial render (<100ms for position calc)

---

## Troubleshooting

### Issue: Wires not appearing

**Check:**
1. `controllerId` prop matches between container and wrappers
2. Controller and device cards have rendered (not loading state)
3. Container has minimum height for visibility

**Debug:**
```tsx
useEffect(() => {
  console.log('Controller ID:', controllerId);
  console.log('Controller element:', document.querySelector(`[data-controller-id="${controllerId}"]`));
  console.log('Device elements:', document.querySelectorAll(`[data-device-controller="${controllerId}"]`));
}, [controllerId]);
```

### Issue: Wires in wrong position

**Check:**
1. Container has `relative` positioning (should be automatic)
2. Cards aren't `position: fixed` or `absolute` relative to different parent
3. No CSS transforms on parent elements

**Fix:**
```tsx
<ConnectionWireContainer className="relative"> {/* explicit */}
```

### Issue: Animation stuttering

**Solutions:**
1. Reduce number of devices (paginate or filter)
2. Disable animation for some wires:
```tsx
<DeviceCardWrapper animated={false}>
```
3. Check browser performance (GPU acceleration enabled)

### Issue: Layout shifts during render

**Fix:**
Set explicit dimensions on cards:
```tsx
<Card className="min-h-[200px]">
```

Or use skeleton loaders:
```tsx
{loading ? <SkeletonCard /> : <ActualCard />}
```

---

## Performance Optimization

### For pages with many controllers (10+)

**Option 1: Pagination**
```tsx
const [page, setPage] = useState(1);
const controllersToShow = controllers.slice((page - 1) * 5, page * 5);
```

**Option 2: Lazy Loading**
```tsx
const ControllerSection = lazy(() => import('./ControllerSection'));

<Suspense fallback={<Skeleton />}>
  <ControllerSection controllerId={id} />
</Suspense>
```

**Option 3: Virtual Scrolling**
```tsx
import { useVirtualizer } from '@tanstack/react-virtual';
// Render only visible controllers
```

### For pages with many devices per controller (20+)

**Option 1: Tabs/Accordion**
```tsx
<Tabs>
  <TabsList>
    {deviceGroups.map(group => <TabsTrigger>{group.name}</TabsTrigger>)}
  </TabsList>
  {deviceGroups.map(group => (
    <TabsContent>
      {/* Wires only for visible tab */}
    </TabsContent>
  ))}
</Tabs>
```

**Option 2: Disable animation**
```tsx
<DeviceCardWrapper animated={false}>
```

---

## Migration Checklist

To add wires to an existing page:

1. **Import components** (2 min)
   - [ ] Add imports from `@/components/controllers/ConnectionWireContainer`

2. **Wrap layout** (1 min)
   - [ ] Wrap main container with `ConnectionWireContainer`
   - [ ] Pass `controllerId` prop

3. **Wrap controller card** (1 min)
   - [ ] Wrap controller card with `ControllerCardWrapper`
   - [ ] Pass `controllerId` prop

4. **Wrap device cards** (3 min)
   - [ ] Wrap each device card with `DeviceCardWrapper`
   - [ ] Pass required props: `deviceId`, `controllerId`, `deviceType`, `isActive`

5. **Test** (3 min)
   - [ ] Visual check
   - [ ] Toggle devices
   - [ ] Resize window

**Total time: ~10 minutes per page**

---

## Next Steps

After integration:
1. Visit `/demo/wire-connections` to see reference implementation
2. Test in different browsers (Chrome, Firefox, Safari)
3. Test on mobile devices
4. Gather user feedback
5. Consider adding to more pages

## Support

Questions? Check:
- `CONNECTION_WIRES_README.md` - Full API reference
- `ARCHITECTURE_DIAGRAM.md` - Technical details
- `ConnectionWireExample.tsx` - Example code
- `/demo/wire-connections` - Live demo
