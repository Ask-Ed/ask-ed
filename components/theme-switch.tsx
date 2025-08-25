"use client";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useState, useEffect, memo } from "react";

interface ThemeSwitchProps {
	className?: string;
	size?: "sm" | "default" | "lg";
}

export const ThemeSwitch = memo(function ThemeSwitch({ className, size = "default" }: ThemeSwitchProps) {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<div className={cn("relative", className)}>
				<Switch
					size={size}
					checked={false}
					disabled
					className="bg-background border border-border shadow-sm opacity-50"
					aria-label="Loading theme switch"
					thumb={
						<Sun
							className={cn(
								size === "sm" && "h-3 w-3",
								size === "default" && "h-4 w-4",
								size === "lg" && "h-5 w-5",
								"opacity-50"
							)}
						/>
					}
				/>
			</div>
		);
	}

	const isDark = theme === "dark";

	return (
		<div className={cn("relative", className)}>
			<Switch
				size={size}
				checked={isDark}
				onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
				className="bg-background border border-border shadow-sm"
				aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
				thumb={
					isDark ? (
						<Moon
							className={cn(
								size === "sm" && "h-3 w-3",
								size === "default" && "h-4 w-4",
								size === "lg" && "h-5 w-5",
							)}
						/>
					) : (
						<Sun
							className={cn(
								size === "sm" && "h-3 w-3",
								size === "default" && "h-4 w-4",
								size === "lg" && "h-5 w-5",
							)}
						/>
					)
				}
			/>
		</div>
	);
});
