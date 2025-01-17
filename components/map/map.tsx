"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import { Map as LeafletMap } from "leaflet"; // Ensure this is imported for type
import L, { Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
// import { Icon } from "leaflet";
import { useVehicles } from "@/hooks/use-vehicles";
import { Car, Bike, Dot } from 'lucide-react'; // Import Lucide React's car icon
import ReactDOMServer from 'react-dom/server'; // To render React components as static HTML
import { Vehicle, LocationUpdate } from "@/vehicleData/data";

// // Custom marker icon
// const vehicleIcon = new Icon({
//   iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
//   iconSize: [25, 41],
//   iconAnchor: [12, 41],
// });

// Function to convert a React component into static HTML
const createIconFromComponent = (component: JSX.Element) => {
  return new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(ReactDOMServer.renderToStaticMarkup(component)),  // Convert the component to base64 encoded SVG
    iconSize: [30, 30], // Adjust the size of the icon
    iconAnchor: [15, 30], // Adjust the anchor point for proper alignment
  });
};

interface MapProps {
  onVehicleSelect: (id: string) => void;
  selectedVehicleId: string | null;
}

// Define the type for the ref
type MarkerRef = {
  [key: string]: LeafletMarker; // Vehicle numbers as keys, Leaflet markers as values
};

export default function Map({ onVehicleSelect, selectedVehicleId }: MapProps) {
  const { vehicles } = useVehicles();
  const [map, setMap] = useState<LeafletMap | null>(null);
  const markersRef = useRef<MarkerRef>({}); // Typed ref for markers

  const [selectedVehicleJourney, setSelectedVehicleJourney] = useState<any[]>([]);

  const startingPointIcon = createIconFromComponent(<Dot size={50} color="black" />); // Use the size and color you want

  function getLocationUpdatesLastHour(vehicle: Vehicle) {
    // Convert all location updates to date objects
    const updatesWithDate = vehicle.locationUpdates.map(update => {
      // Parse and reformat the date to YYYY-MM-DD
        const [day, month, year] = update.date.split("/");
        const formattedDate = `${year}-${month}-${day}`;

        // Handle the time parsing using a reliable library or manually
        const timeParts:any = update.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!timeParts) {
          throw new Error("Invalid time format");
        }

        let [_, hours, minutes, period] = timeParts;
        hours = parseInt(hours, 10);
        minutes = parseInt(minutes, 10);

        if (period.toUpperCase() === "PM" && hours !== 12) {
          hours += 12;
        } else if (period.toUpperCase() === "AM" && hours === 12) {
          hours = 0;
        }

        const formattedTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;

        // Combine date and time into an ISO string
        const formattedDateTime = `${formattedDate}T${formattedTime}`;
        const date = new Date(formattedDateTime);
      //   console.log(date)
        return { ...update, dateObject: date };
    });
  
    // Find the latest location update
    const latestUpdate = updatesWithDate.reduce((latest, current) => {
      return current.dateObject > latest.dateObject ? current : latest;
    });
  
    // Calculate the time difference (1 hour = 60 minutes)
    const oneHourBefore = new Date(latestUpdate.dateObject.getTime() - (30 * 60 * 1000));
  
    // Filter location updates within the last hour
    const updatesLastHour = updatesWithDate.filter(update => update.dateObject >= oneHourBefore);
  
    // Return the filtered location updates
    return updatesLastHour.map(update => ({
      date: update.date,
      time: update.time,
      latitude: update.latitude,
      longitude: update.longitude,
      area: update.area,
      ignition: update.ignition,
      speed: update.speed,
      status: update.status,
      distance: update.distance
    }));
  }
  

  // Center map on selected vehicle
  useEffect(() => {
    if (map && selectedVehicleId) {
      const vehicle = vehicles.find((v) => v.vehicleNumber === selectedVehicleId);
      if (vehicle) {
        // // Get the latest location update for the selected vehicle
        // const latestUpdate = vehicle.locationUpdates[vehicle.locationUpdates.length - 1];
        // map.setView([latestUpdate.latitude, latestUpdate.longitude], 15);

        // // Open the popup for the selected vehicle
        // const marker = markersRef.current[selectedVehicleId];
        // if (marker) marker.openPopup();

         // Filter location updates to only include the last hour
         const recentUpdates = getLocationUpdatesLastHour(vehicle);
        //  console.log(recentUpdates)
         
         // Get all location updates for the selected vehicle
         const journey = recentUpdates.map(update => [update.latitude, update.longitude]);
        //  console.log(journey)
         setSelectedVehicleJourney(journey);
 
         // Center map on the first point of the journey (if available)
         const firstUpdate = recentUpdates[0];
         if (firstUpdate) {
           map.setView([firstUpdate.latitude, firstUpdate.longitude], 15);
         }
 
         // Open the popup for the selected vehicle
         const marker = markersRef.current[selectedVehicleId];
         if (marker) marker.openPopup();
      }
    }
  }, [selectedVehicleId, vehicles, map]);

  return (
    <MapContainer
      center={[24.8007, 67.0711]}
      zoom={13}
      className="h-full w-full"
      // @ts-ignore
      whenReady={(event: L.LeafletEvent) => setMap(event.target as L.Map)}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {vehicles.map((vehicle) => {
        // Filter the vehicle's updates for the last hour
        const recentUpdates = getLocationUpdatesLastHour(vehicle);

        // Ensure recentUpdates is not empty before proceeding
        if (recentUpdates.length === 0) return null;

        // Get the latest location update for each vehicle
        const latestUpdate = recentUpdates[recentUpdates.length - 1];

        // Create a Lucide Car icon for the vehicle
        const vehicleIcon = createIconFromComponent(<Car size={30} color="blue" />); // Use the size and color you want
        
        return (
          <Marker
            key={vehicle.vehicleNumber}
            position={[latestUpdate.latitude, latestUpdate.longitude]}
            icon={vehicleIcon}
            ref={(marker) => {
              if (marker) markersRef.current[vehicle.vehicleNumber] = marker;
            }}
            eventHandlers={{
              click: () => onVehicleSelect(vehicle.vehicleNumber),
            }}
          >
            <Popup offset={[0, -20]}>
              <div className="p-0">
                <h3 className="font-semibold">{vehicle.vehicleNumber}</h3>
                <p>Area: {latestUpdate.area}</p>
                <p>Time: {latestUpdate.time}</p>
                <p>Date: {latestUpdate.date}</p>
              </div>
            </Popup>
          </Marker>
        );
      })}

      {/* Plot the selected vehicle's journey if it exists */}
      {selectedVehicleJourney.length > 0 && (
        <>
          <Polyline
            positions={selectedVehicleJourney}
            color="blue"
            weight={4}
            opacity={0.7}
          />
          {/* Add starting point marker */}
          <Marker
            position={selectedVehicleJourney[0]} // First point in the journey
            icon={startingPointIcon} // Use the custom icon for the starting point
          >
            <Popup offset={[0, -20]}>
              <div className="p-0">
                <h3 className="font-semibold">Starting Point</h3>
                <p>Journey Start</p>
              </div>
            </Popup>
          </Marker>
        </>
      )}
    </MapContainer>
  );
}
