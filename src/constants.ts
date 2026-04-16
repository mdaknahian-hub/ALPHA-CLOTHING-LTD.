import { Order, ProductionEntry } from "./types";

export const DEFAULT_ORDERS: Order[] = [
  { id: 1, buyer: 'BASSPRO', style: 'NRF26-2015W', poNo: 'PO-1001', shipDate: '2026-04-19', color: 'Flintstone', orderQty: 2400 },
  { id: 2, buyer: 'BASSPRO', style: 'NRF26-2015W', poNo: 'PO-1001', shipDate: '2026-04-19', color: 'Burnt Olive', orderQty: 1800 },
  { id: 3, buyer: 'BASSPRO', style: 'NRF262174K', poNo: 'PO-1002', shipDate: '2026-04-22', color: 'Antracite', orderQty: 3000 },
  { id: 4, buyer: 'BASSPRO', style: 'NRF262174K', poNo: 'PO-1002', shipDate: '2026-04-22', color: 'Granite Green', orderQty: 2200 },
  { id: 5, buyer: "KOHL'S", style: 'WT42A106', poNo: 'PO-1003', shipDate: '2026-04-25', color: 'Navy', orderQty: 4000 },
  { id: 6, buyer: "KOHL'S", style: 'WT42A106', poNo: 'PO-1003', shipDate: '2026-04-25', color: 'White', orderQty: 3500 },
  { id: 7, buyer: 'JCP', style: 'JC391513', poNo: 'PO-1004', shipDate: '2026-04-18', color: 'Madison Strp', orderQty: 5000 },
  { id: 8, buyer: 'JCP', style: 'JC391046', poNo: 'PO-1005', shipDate: '2026-04-28', color: 'White', orderQty: 2800 },
  { id: 9, buyer: 'JCP', style: 'JC391046', poNo: 'PO-1005', shipDate: '2026-04-28', color: 'Black', orderQty: 2200 },
  { id: 10, buyer: 'JCP', style: 'JC391046', poNo: 'PO-1005', shipDate: '2026-04-28', color: 'Kentucky Blue', orderQty: 1500 },
  { id: 11, buyer: 'RHF26', style: '8694W', poNo: 'PO-1006', shipDate: '2026-04-20', color: 'Cappuccino', orderQty: 3200 },
];

export const DEFAULT_ENTRIES: ProductionEntry[] = [
  { id: 1, date: '2026-04-10', poNo: 'PO-1001', color: 'Flintstone', cut: 800, sewOut: 720, washR: 700, finIn: 660, finOut: 640, poly: 620, shipment: 0 },
  { id: 2, date: '2026-04-10', poNo: 'PO-1003', color: 'Navy', cut: 600, sewOut: 540, washR: 520, finIn: 480, finOut: 460, poly: 440, shipment: 0 },
  { id: 3, date: '2026-04-10', poNo: 'PO-1006', color: 'Cappuccino', cut: 500, sewOut: 450, washR: 430, finIn: 400, finOut: 390, poly: 370, shipment: 0 },
  { id: 4, date: '2026-04-11', poNo: 'PO-1001', color: 'Flintstone', cut: 820, sewOut: 750, washR: 730, finIn: 690, finOut: 670, poly: 650, shipment: 0 },
  { id: 5, date: '2026-04-11', poNo: 'PO-1002', color: 'Antracite', cut: 500, sewOut: 450, washR: 430, finIn: 390, finOut: 370, poly: 350, shipment: 0 },
  { id: 6, date: '2026-04-11', poNo: 'PO-1004', color: 'Madison Strp', cut: 700, sewOut: 640, washR: 620, finIn: 580, finOut: 560, poly: 540, shipment: 0 },
  { id: 7, date: '2026-04-12', poNo: 'PO-1001', color: 'Flintstone', cut: 850, sewOut: 780, washR: 760, finIn: 720, finOut: 700, poly: 680, shipment: 0 },
  { id: 8, date: '2026-04-12', poNo: 'PO-1002', color: 'Antracite', cut: 520, sewOut: 470, washR: 450, finIn: 410, finOut: 390, poly: 370, shipment: 0 },
  { id: 9, date: '2026-04-12', poNo: 'PO-1003', color: 'Navy', cut: 630, sewOut: 580, washR: 560, finIn: 520, finOut: 500, poly: 480, shipment: 0 },
  { id: 10, date: '2026-04-12', poNo: 'PO-1004', color: 'Madison Strp', cut: 720, sewOut: 660, washR: 640, finIn: 600, finOut: 580, poly: 560, shipment: 0 },
  { id: 11, date: '2026-04-12', poNo: 'PO-1005', color: 'White', cut: 400, sewOut: 360, washR: 340, finIn: 300, finOut: 280, poly: 260, shipment: 0 },
  { id: 12, date: '2026-04-12', poNo: 'PO-1006', color: 'Cappuccino', cut: 550, sewOut: 500, washR: 480, finIn: 440, finOut: 420, poly: 400, shipment: 0 },
];

export const BUYERS = ['BASSPRO', "KOHL'S", 'JCP', 'TOMMY HILFIGER', 'NEXT', 'ASOS', 'PRIMARK', 'M&S', 'TARGET', 'WALMART', 'RHF26'];
