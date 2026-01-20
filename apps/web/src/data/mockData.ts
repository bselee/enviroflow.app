import { Room } from "@/components/dashboard/RoomCard";

export const mockRooms: Room[] = [
  {
    id: "1",
    name: "Veg Room A",
    isOnline: true,
    workflowActive: true,
    temperature: 72,
    humidity: 55,
    vpd: 0.9,
    fanSpeed: 60,
    lightLevel: 80,
    lastUpdate: "2 seconds ago",
  },
  {
    id: "2",
    name: "Flower Room 1",
    isOnline: true,
    workflowActive: true,
    temperature: 78,
    humidity: 45,
    vpd: 1.2,
    fanSpeed: 75,
    lightLevel: 100,
    lastUpdate: "5 seconds ago",
  },
  {
    id: "3",
    name: "Clone Tent",
    isOnline: true,
    workflowActive: false,
    temperature: 80,
    humidity: 85,
    vpd: 0.5,
    fanSpeed: 30,
    lightLevel: 40,
    lastUpdate: "10 seconds ago",
  },
  {
    id: "4",
    name: "Drying Room",
    isOnline: false,
    workflowActive: false,
    temperature: 65,
    humidity: 60,
    vpd: 0.8,
    fanSpeed: 0,
    lightLevel: 0,
    lastUpdate: "3 hours ago",
  },
];

export interface Controller {
  id: string;
  name: string;
  brand: "ac_infinity" | "inkbird" | "generic_wifi";
  controllerId: string;
  isOnline: boolean;
  lastSeen: string;
  roomId?: string;
  roomName?: string;
}

export const mockControllers: Controller[] = [
  {
    id: "1",
    name: "Controller 69 Pro",
    brand: "ac_infinity",
    controllerId: "AC-001-XYZ",
    isOnline: true,
    lastSeen: "Just now",
    roomId: "1",
    roomName: "Veg Room A",
  },
  {
    id: "2",
    name: "Inkbird ITC-308",
    brand: "inkbird",
    controllerId: "INK-308-ABC",
    isOnline: true,
    lastSeen: "1 minute ago",
    roomId: "2",
    roomName: "Flower Room 1",
  },
  {
    id: "3",
    name: "WiFi Outlet Pro",
    brand: "generic_wifi",
    controllerId: "WIFI-123-DEF",
    isOnline: false,
    lastSeen: "3 hours ago",
    roomId: "4",
    roomName: "Drying Room",
  },
];
