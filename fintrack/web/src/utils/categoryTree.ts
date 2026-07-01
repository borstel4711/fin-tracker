import type { Category } from '../types';

export interface GroupedCategory {
  category: Category;
  depth: 0 | 1;
}

// Kategorien sind maximal eine Ebene tief verschachtelt (Backend erzwingt das).
// Top-Level-Kategorien alphabetisch sortiert, direkt gefolgt von ihren
// (ebenfalls alphabetisch sortierten) Unterkategorien.
export function groupCategoriesByParent(categories: Category[]): GroupedCategory[] {
  const childrenByParent = new Map<number, Category[]>();
  const topLevel: Category[] = [];
  for (const c of categories) {
    if (c.parent_id == null) {
      topLevel.push(c);
    } else {
      if (!childrenByParent.has(c.parent_id)) childrenByParent.set(c.parent_id, []);
      childrenByParent.get(c.parent_id)!.push(c);
    }
  }
  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, 'de');
  const result: GroupedCategory[] = [];
  for (const parent of topLevel.sort(byName)) {
    result.push({ category: parent, depth: 0 });
    const children = childrenByParent.get(parent.id) ?? [];
    for (const child of children.sort(byName)) {
      result.push({ category: child, depth: 1 });
    }
  }
  return result;
}
