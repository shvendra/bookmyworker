import categories from "../../shared/data/categories.json";

type Sub = { label: string; hindilabel: string; marathilabel: string; gujaratilabel: string; value: string };
type Cat = { value: string; subcategories: Sub[] };
const cats = categories as unknown as Cat[];

const NEW: Record<string, string[]> = {
  agriculture_farming_workers: ["farm_supervisor"],
  "Automobile & Workshop Workers": ["workshop_supervisor"],
  construction_project_workers: ["construction_site_supervisor"],
  event_decoration_workers: ["event_supervisor"],
  "Healthcare Support Workers": ["hospital_support_supervisor"],
  hospitality_service_workers: ["hospitality_supervisor"],
  household_domestic_workers: ["domestic_staff_supervisor"],
  "Security & Facility Workers": ["facility_services_supervisor", "security_guard_supervisor"],
  skilled_technical_workers: ["technical_supervisor"],
  specialized_creative_workers: ["studio_supervisor"],
  transport_logistics_workers: ["logistics_warehouse_supervisor"],
};
const REGULAR = ["agriculture_farming_workers", "Automobile & Workshop Workers", "construction_project_workers", "event_decoration_workers", "Healthcare Support Workers", "hospitality_service_workers", "household_domestic_workers", "manufacturing_industrial_workers", "retail_shop_workers", "Security & Facility Workers", "skilled_technical_workers", "specialized_creative_workers", "transport_logistics_workers"];

describe("Supervisor sub-categories in the app's category data", () => {
  it("each of the 13 regular categories offers a supervisor", () => {
    for (const v of REGULAR) {
      const c = cats.find((x) => x.value === v)!;
      expect(c.subcategories.some((s) => /supervis/i.test(`${s.value} ${s.label}`))).toBe(true);
    }
  });
  it("the new ones are in the right place with all four languages and are not duplicated", () => {
    for (const [cat, values] of Object.entries(NEW)) {
      const subs = cats.find((c) => c.value === cat)!.subcategories;
      for (const v of values) {
        const hits = subs.filter((s) => s.value === v);
        expect(hits).toHaveLength(1);
        for (const k of ["label", "hindilabel", "marathilabel", "gujaratilabel"] as const) expect(String(hits[0][k]).trim().length).toBeGreaterThan(2);
      }
    }
  });
  it("does not collide with the support-staff taxonomy that shares this file", () => {
    const support = cats.filter((c) => !REGULAR.includes(c.value));
    const supportValues = new Set(support.flatMap((c) => c.subcategories.map((s) => s.value)));
    for (const v of Object.values(NEW).flat()) expect(supportValues.has(v)).toBe(false);
    for (const v of ["site_supervisor", "warehouse_supervisor", "security_supervisor", "facility_supervisor"]) expect(supportValues.has(v)).toBe(true);
  });
});
