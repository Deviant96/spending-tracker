"use client";

import InstallmentManager from "@/components/InstallmentManager";
import Breadcrumbs from "@/components/Breadcrumbs";

export default function InstallmentsPage() {
  return (
    <main className="container mx-auto p-6">
      <Breadcrumbs />
      
      <div className="mt-6">
        <InstallmentManager showAll={true} />
      </div>
    </main>
  );
}
