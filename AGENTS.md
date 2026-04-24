# Project Instructions

## Project Context
This is a Garment Production Management System with the following core modules:
- **Order Master**: Managing buyer orders, styles, and total quantities.
- **Production Entry**: Tracking daily input, output, and losses.
- **Finishing Tracker**: Monitoring the final stages of garment production.
- **System Health**: Admin tools for maintenance, data cleanup (Master Reset), and performance monitoring.
- **Excel Upload**: Bulk data import capabilities.

## Technical Rules
You will always:
- Use clear and descriptive variable names.
- Ensure all UI components are responsive.
- Follow the design style of the existing components (Sidebar navigation, consistent card styling).
- Maintain strict security rules for Firestore as defined in the project.
- Use Bengali for user-facing success/error messages if requested by the user.
- **Super Admin Identity**: The email `aknahian@gmail.com` is the hardcoded Super Admin with full destructive privileges (like Master Wipe).

## Style Guidelines
- Use Lucide-React for icons.
- Use Tailwind CSS for all styling.
- Keep the logic separated: components for UI, and `src/firebase.ts` for database interactions.
