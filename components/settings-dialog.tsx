"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { useUserStore } from "@/lib/store/user-store";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BookOpen,
  Check,
  Chrome,
  Link,
  Loader2,
  Moon,
  Palette,
  RefreshCw,
  Settings,
  Sun,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";
import { toast } from "sonner";

const themes = [
  {
    id: "default",
    name: "Default",
    colors: {
      primary: "oklch(0.50 0.14 220)", // Blue
      background: "#ffffff",
      sidebar: "#f8fafc",
      accent: "#e2e8f0",
    },
  },
  {
    id: "purple",
    name: "Purple",
    colors: {
      primary: "oklch(0.50 0.14 285)", // Purple
      background: "#ffffff",
      sidebar: "#f8fafc",
      accent: "#e2e8f0",
    },
  },
  {
    id: "emerald",
    name: "Emerald",
    colors: {
      primary: "oklch(0.55 0.12 160)", // Emerald
      background: "#ffffff",
      sidebar: "#f8fafc",
      accent: "#e2e8f0",
    },
  },
  {
    id: "rose",
    name: "Rose",
    colors: {
      primary: "oklch(0.55 0.14 350)", // Rose
      background: "#ffffff",
      sidebar: "#f8fafc",
      accent: "#e2e8f0",
    },
  },
];

interface ThemePreviewProps {
  theme: (typeof themes)[0];
  isSelected: boolean;
  onClick: () => void;
}

function ThemePreview({ theme, isSelected, onClick }: ThemePreviewProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative w-full aspect-square rounded-xl border-2 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg",
        isSelected
          ? "border-brand-primary shadow-md"
          : "border-border hover:border-brand-primary/60 dark:border-gray-700 dark:hover:border-brand-primary/70"
      )}
      style={{ backgroundColor: theme.colors.background }}
    >
      {/* Theme preview mockup */}
      <div className="absolute inset-2 flex overflow-hidden rounded-lg">
        {/* Sidebar */}
        <div
          className="w-1/3 rounded-l-md flex flex-col gap-1 p-1.5"
          style={{ backgroundColor: theme.colors.sidebar }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: theme.colors.primary }}
          />
          <div className="w-full h-1 bg-black/10 rounded-sm" />
          <div className="w-3/4 h-1 bg-black/10 rounded-sm" />
          <div className="w-full h-1 bg-black/10 rounded-sm" />
          <div className="w-2/3 h-1 bg-black/10 rounded-sm" />
        </div>

        {/* Main content area */}
        <div className="flex-1 p-1.5 flex flex-col gap-1">
          <div className="w-full h-1 bg-black/10 rounded-sm" />
          <div className="w-4/5 h-1 bg-black/10 rounded-sm" />
          <div
            className="flex-1 rounded-md mt-1"
            style={{ backgroundColor: theme.colors.accent }}
          />
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-brand-primary rounded-full flex items-center justify-center shadow-lg border-2 border-background">
          <Check className="w-2.5 h-2.5 text-white" />
        </div>
      )}

      {/* Subtle hover effect overlay */}
      <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/5 transition-colors duration-200" />
    </button>
  );
}

interface SettingsDialogProps {
  children?: React.ReactNode;
}

// Custom DialogContent with clean styling
const SettingsDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  React.ComponentPropsWithoutRef<typeof DialogContent>
>(({ className, ...props }, ref) => (
  <DialogContent
    ref={ref}
    className={cn(
      "p-0 gap-0 overflow-hidden shadow-2xl bg-card text-card-foreground",
      "!max-w-[750px] !w-[85vw] !h-[500px] !rounded-2xl",
      className
    )}
    {...props}
  />
));
SettingsDialogContent.displayName = "SettingsDialogContent";

export function SettingsDialog({ children }: SettingsDialogProps) {
  const user = useQuery(api.auth.getCurrentUser);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // User store
  const {
    extension,
    token,
    preferences,
    health,
    isCheckingExtension,
    canEnableAutoDetection,
    shouldShowTokenAttention,
    getActiveToken,
    isTokenReadonly,
    isTokenHealthy,
    setManualToken,
    toggleAutoDetection,
    checkTokenHealth
  } = useUserStore();

  const [activeSection, setActiveSection] = React.useState<
    "account" | "appearance" | "connections"
  >("account");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [selectedTheme, setSelectedTheme] = React.useState("default");
  const [darkMode, setDarkMode] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);
  const [localTokenValue, setLocalTokenValue] = React.useState("");

  // Get current token value - use local state if available, otherwise store value
  const storeTokenValue = getActiveToken();
  const edSessionKey = isTokenReadonly() ? storeTokenValue : localTokenValue;

  // Track original values to detect changes
  const [originalValues, setOriginalValues] = React.useState({
    firstName: "",
    lastName: "",
    edSessionKey: "",
  });

  // Check if any changes have been made
  const hasChanges = React.useMemo(() => {
    if (activeSection === "account") {
      return (
        firstName !== originalValues.firstName ||
        lastName !== originalValues.lastName
      );
    }
    if (activeSection === "connections" && !isTokenReadonly()) {
      return localTokenValue !== originalValues.edSessionKey;
    }
    return false;
  }, [firstName, lastName, localTokenValue, activeSection, originalValues, isTokenReadonly]);

  const showTokenAttention = shouldShowTokenAttention();

  // Initialize component
  React.useEffect(() => {
    setMounted(true);
    
    // Initialize theme state
    if (theme) {
      setDarkMode(theme === "dark");
    }
    
    // Initialize selected theme
    const currentTheme = document.documentElement.getAttribute("data-theme") || "default";
    setSelectedTheme(currentTheme);
  }, [theme]);

  // Initialize user data
  React.useEffect(() => {
    if (user) {
      const nameParts = user.name ? user.name.split(" ") : ["", ""];
      const firstNameValue = nameParts[0] || "";
      const lastNameValue = nameParts.slice(1).join(" ") || "";

      setFirstName(firstNameValue);
      setLastName(lastNameValue);
      setEmail(user.email || "");

      // Set original values for change detection
      const tokenValue = getActiveToken();
      setOriginalValues({
        firstName: firstNameValue,
        lastName: lastNameValue,
        edSessionKey: tokenValue,
      });
      // Initialize local token state
      setLocalTokenValue(tokenValue);
    }
  }, [user, getActiveToken]);

  // Update local token state when store token changes (e.g., from extension)
  React.useEffect(() => {
    if (mounted && isTokenReadonly()) {
      const tokenValue = getActiveToken();
      setLocalTokenValue(tokenValue);
      setOriginalValues((prev) => ({
        ...prev,
        edSessionKey: tokenValue,
      }));
    }
  }, [mounted, getActiveToken, isTokenReadonly]);

  const handleSaveProfile = async () => {
    if (activeSection === "account") {
      if (!user) {
        console.error("User information is missing, cannot update profile");
        toast.error("Cannot update profile: User information is missing.");
        return;
      }

      if (!firstName.trim() || !lastName.trim()) {
        toast.error("First name and last name are required.");
        return;
      }
    }

    setIsSavingProfile(true);
    setSaveSuccess(false);

    try {
      if (activeSection === "account") {
        const fullName = `${firstName.trim()} ${lastName.trim()}`;

        // Update user profile through Better Auth
        const result = await authClient.updateUser({
          name: fullName,
        });

        if (result.error) {
          throw new Error(result.error.message || "Failed to update profile");
        }

        // Update original values after successful save
        setOriginalValues((prev) => ({
          ...prev,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        }));
      } else if (activeSection === "connections") {
        // Save manual token (only if not readonly)
        if (!isTokenReadonly()) {
          setManualToken(localTokenValue);
          // Trigger health check after successful save
          setTimeout(() => checkTokenHealth(), 200);
        }

        // Update original values after successful save
        setOriginalValues((prev) => ({
          ...prev,
          edSessionKey: localTokenValue,
        }));
      }
      // Theme is automatically saved by next-themes

      setSaveSuccess(true);
      toast.success("Settings saved successfully!");
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: unknown) {
      console.error("Failed to save settings:", error);
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to save settings. Please try again.";
      toast.error(errorMsg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSectionChange = (
    section: "account" | "appearance" | "connections"
  ) => {
    setActiveSection(section);
  };

  const handleAutoDetectionToggle = () => {
    toggleAutoDetection();
  };

  const handleDarkModeToggle = (checked: boolean) => {
    setDarkMode(checked);
    setTheme(checked ? "dark" : "light");
  };

  const handleThemeChange = (themeId: string) => {
    setSelectedTheme(themeId);
    if (themeId === "default") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", themeId);
    }
    // Save to localStorage for persistence
    localStorage.setItem("color-theme", themeId);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
            <span className="sr-only">Settings</span>
          </Button>
        )}
      </DialogTrigger>
      <SettingsDialogContent>
        <motion.div
          className="flex h-full"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          {/* Sidebar */}
          <div className="bg-muted/50 border-r border-border flex flex-col w-48">
            <div className="p-4 py-5">
              <DialogTitle className="text-lg font-semibold mb-5">
                Settings
              </DialogTitle>

              <nav className="space-y-4">
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                    Account
                  </h3>
                  <div className="space-y-1">
                    <SettingsNavItem
                      icon={User}
                      label="My Profile"
                      active={activeSection === "account"}
                      onClick={() => handleSectionChange("account")}
                    />
                    <SettingsNavItem
                      icon={Palette}
                      label="Appearance"
                      active={activeSection === "appearance"}
                      onClick={() => handleSectionChange("appearance")}
                    />
                    <SettingsNavItem
                      icon={Link}
                      label="Connections"
                      active={activeSection === "connections"}
                      onClick={() => handleSectionChange("connections")}
                      showAttention={showTokenAttention}
                    />
                  </div>
                </div>
              </nav>
            </div>

            <div className="p-3 mt-auto border-t border-border">
              <DeleteAccountButton />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 bg-card flex flex-col relative">
            {/* Scrollable content area */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence mode="wait">
                {activeSection === "account" && (
                  <motion.div
                    key="account"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="p-6 pb-20"
                  >
                    <div className="mb-6">
                      <h2 className="text-xl font-semibold mb-1">My Profile</h2>
                      <p className="text-muted-foreground text-sm">
                        Update your personal information
                      </p>
                    </div>

                    <div className="space-y-4 max-w-md">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <motion.div
                          className="space-y-2"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 }}
                        >
                          <Label
                            htmlFor="firstName"
                            className="text-sm font-medium"
                          >
                            First Name
                          </Label>
                          <Input
                            id="firstName"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            disabled={isSavingProfile}
                            className="h-9"
                          />
                        </motion.div>

                        <motion.div
                          className="space-y-2"
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                        >
                          <Label
                            htmlFor="lastName"
                            className="text-sm font-medium"
                          >
                            Last Name
                          </Label>
                          <Input
                            id="lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            disabled={isSavingProfile}
                            className="h-9"
                          />
                        </motion.div>
                      </div>

                      <motion.div
                        className="space-y-2"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                      >
                        <Label htmlFor="email" className="text-sm font-medium">
                          Email Address
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          readOnly
                          disabled
                          className="cursor-not-allowed h-9"
                        />
                      </motion.div>
                    </div>
                  </motion.div>
                )}

                {activeSection === "appearance" && (
                  <motion.div
                    key="appearance"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="p-6 pb-16 h-full overflow-y-auto"
                  >
                    <div className="mb-6">
                      <h2 className="text-xl font-semibold mb-1">Appearance</h2>
                      <p className="text-muted-foreground text-sm">
                        Customize the look and feel
                      </p>
                    </div>

                    <div className="space-y-4 max-w-lg">
                      {/* Theme Grid */}
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                      >
                        <h3 className="text-base font-medium mb-1">Theme</h3>
                        <p className="text-muted-foreground text-xs mb-4">
                          Choose your interface theme
                        </p>

                        <div className="grid grid-cols-4 gap-3">
                          {themes.slice(0, 4).map((themeOption) => (
                            <div key={themeOption.id} className="space-y-2">
                              <ThemePreview
                                theme={themeOption}
                                isSelected={selectedTheme === themeOption.id}
                                onClick={() =>
                                  handleThemeChange(themeOption.id)
                                }
                              />
                              <p className="text-xs font-medium text-center text-muted-foreground">
                                {themeOption.name}
                              </p>
                            </div>
                          ))}
                        </div>
                      </motion.div>

                      {/* Dark Mode Toggle */}
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="pt-4 border-t"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              {darkMode ? (
                                <Moon className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <Sun className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                            <span className="font-medium">Dark Mode</span>
                          </div>
                          <Switch
                            checked={darkMode}
                            onCheckedChange={handleDarkModeToggle}
                            className="data-[state=checked]:bg-brand-primary"
                          />
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                )}

                {activeSection === "connections" && (
                  <motion.div
                    key="connections"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="p-6 pb-20"
                  >
                    <div className="mb-6">
                      <h2 className="text-xl font-semibold mb-1">
                        Connections
                      </h2>
                      <p className="text-muted-foreground text-sm">
                        Connect external services and APIs
                      </p>
                    </div>

                    <div className="space-y-4 max-w-lg">
                      {/* ED Discussion Session Key - Primary */}
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="p-4 border rounded-lg bg-card"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex items-center justify-center size-8 bg-emerald-500/10 rounded-md">
                            <BookOpen className="h-4 w-4 text-emerald-500" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-medium">ED Discussion</h3>
                            <p className="text-xs text-muted-foreground">
                              Course integration and sync
                            </p>
                          </div>
                          {isTokenHealthy() && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-600 rounded-full text-xs">
                              <Check className="h-3 w-3" />
                              Connected
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div>
                            <Label
                              htmlFor="edSessionKey"
                              className="text-sm font-medium flex items-center gap-2"
                            >
                              Session Key
                              {token.source === 'extension' && (
                                <span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">
                                  Auto-detected
                                </span>
                              )}
                            </Label>
                            <Input
                              id="edSessionKey"
                              type="password"
                              value={edSessionKey}
                              onChange={(e) => !isTokenReadonly() && setLocalTokenValue(e.target.value)}
                              disabled={isSavingProfile || isTokenReadonly()}
                              placeholder={
                                isTokenReadonly()
                                  ? "Auto-managed by extension"
                                  : "Enter session key or enable auto-detection"
                              }
                              className="h-9 mt-1"
                            />
                          </div>
                          
                          {token.lastUpdated && (
                            <p className="text-xs text-muted-foreground">
                              Last updated: {token.lastUpdated.toLocaleString()}
                            </p>
                          )}
                        </div>
                      </motion.div>

                      {/* Extension Status - Minimal */}
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="p-3 border rounded-lg bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center size-6 bg-blue-500/10 rounded">
                            <Chrome className="h-3 w-3 text-blue-500" />
                          </div>
                          <div className="flex-1">
                            <span className="text-xs font-medium">Browser Extension</span>
                            <p className="text-xs text-muted-foreground">
                              {extension.isConnected ? "Connected" : extension.isInstalled ? "Installed" : "Not detected"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {extension.isConnected && (
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                            )}
                            <Switch
                              checked={preferences.autoDetectionEnabled}
                              onCheckedChange={handleAutoDetectionToggle}
                              disabled={!canEnableAutoDetection() && !preferences.autoDetectionEnabled}
                              size="sm"
                            />
                          </div>
                        </div>
                        
                        {extension.error && (
                          <p className="text-xs text-destructive mt-2 bg-destructive/5 p-2 rounded">
                            {extension.error}
                          </p>
                        )}
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Fixed Save Button */}
            <AnimatePresence>
              {hasChanges && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-0 left-0 right-0 p-4 bg-card/95 backdrop-blur-sm border-t border-border"
                >
                  <div className="flex items-center justify-end gap-4">
                    {saveSuccess && (
                      <motion.div
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center text-sm text-green-600"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Changes saved successfully
                      </motion.div>
                    )}

                    <Button
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                      className="bg-brand-primary hover:bg-brand-primary/90 text-white h-9 px-6"
                    >
                      {isSavingProfile && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Save Changes
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </SettingsDialogContent>
    </Dialog>
  );
}

interface SettingsNavItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
  showAttention?: boolean;
}

function SettingsNavItem({
  icon: Icon,
  label,
  active,
  onClick,
  showAttention,
}: SettingsNavItemProps) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm w-full transition-all relative",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      {showAttention && (
        <div className="ml-auto w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
          <AlertCircle className="h-4 w-4 text-yellow-900" />
        </div>
      )}
    </button>
  );
}

function DeleteAccountButton() {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      console.log(
        "[Settings] Attempting to delete user via authClient.deleteUser..."
      );
      const result = await authClient.deleteUser();

      if (result && "error" in result && result.error) {
        throw new Error(
          result.error.message || "Failed to delete account via authClient"
        );
      }

      console.log("[Settings] authClient.deleteUser succeeded.");
      toast.success("Account deleted successfully");
    } catch (error: unknown) {
      console.error("[Settings] Error deleting account:", error);
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to delete account. Please try again.";
      toast.error(errorMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 gap-2 bg-transparent text-xs"
        >
          <Trash2 className="h-3 w-3" />
          Delete Account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Account</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your
            account and remove all your data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={handleDeleteAccount}
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Account
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
