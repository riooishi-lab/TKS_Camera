"use client";

import { useEffect } from "react";
import { seedIfEmpty } from "@/libs/storage";

export function SeedData() {
	useEffect(() => {
		seedIfEmpty();
	}, []);
	return null;
}
