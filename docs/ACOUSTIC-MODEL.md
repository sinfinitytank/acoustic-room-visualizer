# Acoustic model and limitations

Acoustic Room Visualizer is intended for early-stage room-layout exploration. Its calculations make deliberate simplifications so that the relationships among room geometry, placement, and treatment can be inspected interactively.

## Reflection paths

The Rays view uses finite-plane image-source geometry. Direct, first-order, and second-order paths are accepted only when the calculated intersections lie on the relevant room surfaces or finite treatment objects.

Mounted absorption panels act on the covered room-boundary contact rather than moving the room wall. At each covered contact, retained visual energy is multiplied by `1 - absorption coefficient` for the selected frequency. This is a geometric visualization of relative attenuation, not a calibrated level prediction.

The model does not include source directivity, distance spreading, phase, diffraction, scattering, wave interference, diffusion, edge effects, or measured material behavior. A treatment curve is planning input, not a product certification or a guarantee of performance.

## Room modes

The Mode view calculates ideal eigenmodes for a rigid rectangular room using a sound speed of 343 m/s. Mode orders are length, width, and height, corresponding to world Z, X, and Y. The displayed frequency is:

`f = 343/2 × sqrt((nL/L)^2 + (nW/W)^2 + (nH/H)^2)`

The Room3D colors show opposite pressure phases and nodal regions for the selected ideal mode. The Schroeder marker is an estimate based on the entered RT60 and room volume; it does not alter modal frequencies.

The model does not predict a measured frequency response, damping, source/listener effects, furniture effects, treatment effectiveness, or real-room modal decay.

## Units and stored data

Geometry is stored internally in metres. The interface supports feet, centimetres, and inches through shared conversions. Room designs, libraries, and milestones are kept in browser storage and can be exported as JSON files.

## Use responsibly

Use the visualizations to compare layouts and identify questions for further investigation. For construction decisions, product selection, compliance, or measured acoustic performance, consult calibrated measurements and an appropriately qualified acoustic professional.
