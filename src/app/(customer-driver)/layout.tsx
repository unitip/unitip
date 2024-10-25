import BottomNavbarComponent from "@/components/bottom-navbar";
import BottomNavigation from "@/components/BottomNavigation";
import NavbarComponent from "@/components/navbar";
import { PropsWithChildren } from "react";

export default function Layout(props: PropsWithChildren) {
  return (
    <>
      <div className="bg-muted h-screen w-full overflow-hidden">
        <div className="max-w-lg mx-auto bg-background h-screen shadow relative">
          {/* top navbar */}
          <NavbarComponent />

          {/* content */}
          <div className="h-[calc(100vh-8rem)] overflow-y-auto my-16">
            {props.children}
          </div>

          {/* bottom navbar */}
          <BottomNavigation />
        </div>
      </div>
    </>
  );
}