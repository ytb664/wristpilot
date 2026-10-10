# Wristpilot

Wristpilot mirrors the turn-by-turn guidance of Google Maps on an Android phone onto a Zepp OS watch, so the driver can glance at the wrist instead of the phone.

## Language

**Navigator**:
The app that plans the route and produces guidance. Always Google Maps on the Navigation Phone; Wristpilot never plans routes itself.
_Avoid_: Router, nav engine

**Navigation Phone**:
The Android phone that runs the Navigator and is permanently paired with the watch.
_Avoid_: Host phone, companion phone

**Navigation Session**:
The span from the moment the Navigator starts giving directions until it stops (arrival or cancel).
_Avoid_: Trip, drive, route

**Maneuver**:
One upcoming instruction from the Navigator: the turn to make, the distance until it, and the road it leads onto.
_Avoid_: Direction, step, instruction

**Turn Card**:
The watch screen that shows the current Maneuver during a Navigation Session.
_Avoid_: Direction screen, nav view

**Mini Map**:
A small map of the area around the driver, shown with the Turn Card. Planned after version 1.
_Avoid_: Map view, minimap

**Turn-Now Alert**:
The double buzz on the watch that signals the driver is about to reach the current Maneuver.
_Avoid_: Approach buzz, reminder

**Waiting Screen**:
What the watch shows when Wristpilot is open but no Navigation Session is running.
_Avoid_: Idle screen, empty state

**Stale Turn Card**:
A Turn Card whose Maneuver can no longer be trusted because the watch has lost contact with the Navigation Phone. Shown greyed out.
_Avoid_: Offline card, cached card
