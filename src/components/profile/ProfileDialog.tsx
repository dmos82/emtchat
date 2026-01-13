'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/use-toast';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import {
  User,
  Camera,
  Lock,
  Palette,
  Trash2,
  Download,
  Loader2,
  Check,
  Moon,
  Sun,
  Eye,
  EyeOff,
  ImageIcon,
  Bot,
} from 'lucide-react';
import AISettingsTab from '@/components/ai/AISettingsTab';
import { Switch } from '@/components/ui/switch';

interface ProfileDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    _id: string;
    username: string;
    email?: string;
    role: 'user' | 'admin';
  } | null;
  onLogout?: () => void;
  onIconUpdate?: (iconUrl: string) => void;
  onAvatarToggleChange?: (showAvatar: boolean) => void;
}

interface UserSettings {
  iconUrl?: string;
  displayName?: string;
  customPrompt?: string;
}

const ProfileDialog: React.FC<ProfileDialogProps> = ({
  isOpen,
  onOpenChange,
  user,
  onLogout,
  onIconUpdate,
  onAvatarToggleChange,
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile state
  const [settings, setSettings] = useState<UserSettings>({});
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [displayName, setDisplayName] = useState('');

  // Avatar state
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Dev user: show avatar as sidebar logo
  const [showAvatarAsLogo, setShowAvatarAsLogo] = useState(false);
  const isDevUser = user?.username === 'dev';

  // Load settings when dialog opens
  useEffect(() => {
    if (isOpen && user) {
      loadSettings();
      loadTheme();
      // Load avatar as logo preference for dev user
      if (isDevUser) {
        const savedPref = localStorage.getItem('emtchat-show-avatar-as-logo');
        setShowAvatarAsLogo(savedPref === 'true');
      }
    }
  }, [isOpen, user, isDevUser]);

  const loadSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const response = await fetchWithAuth('/api/users/me/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || {});
        setDisplayName(data.settings?.displayName || '');
        if (data.settings?.iconUrl) {
          setAvatarPreview(data.settings.iconUrl);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const loadTheme = () => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }

  };

  // Avatar handlers
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a JPEG, PNG, GIF, or WebP image.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 10MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const formData = new FormData();
      formData.append('icon', file);

      const response = await fetchWithAuth('/api/users/me/icon', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setAvatarPreview(data.settings.iconUrl);
        setSettings(prev => ({ ...prev, iconUrl: data.settings.iconUrl }));
        // Notify parent component of icon update
        if (onIconUpdate && data.settings.iconUrl) {
          onIconUpdate(data.settings.iconUrl);
        }
        toast({
          title: 'Avatar updated',
          description: 'Your profile picture has been updated.',
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload avatar');
      }
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload avatar',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Password handlers
  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all password fields.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'New password and confirmation must match.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters.',
        variant: 'destructive',
      });
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await fetchWithAuth('/api/users/me/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (response.ok) {
        toast({
          title: 'Password changed',
          description: 'Your password has been updated successfully.',
        });
        // Clear form
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to change password');
      }
    } catch (error) {
      toast({
        title: 'Password change failed',
        description: error instanceof Error ? error.message : 'Failed to change password',
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Theme handlers
  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    // Apply theme to document
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    toast({
      title: 'Theme updated',
      description: `Switched to ${newTheme} mode.`,
    });
  };

  // Export handlers
  const handleExportChats = async () => {
    setIsExporting(true);

    try {
      const response = await fetchWithAuth('/api/chats');
      if (response.ok) {
        const data = await response.json();
        const chats = data.chats || [];

        // Create JSON blob
        const blob = new Blob([JSON.stringify(chats, null, 2)], {
          type: 'application/json',
        });

        // Download file
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `emtchat-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: 'Export complete',
          description: `Exported ${chats.length} chat(s) to JSON file.`,
        });
      } else {
        throw new Error('Failed to fetch chats');
      }
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export chat history.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Delete account handlers
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== user?.username) {
      toast({
        title: 'Confirmation failed',
        description: 'Please type your username exactly to confirm.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetchWithAuth('/api/users/me', {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Account deleted',
          description: 'Your account has been permanently deleted.',
        });
        setShowDeleteConfirm(false);
        onOpenChange(false);
        onLogout?.();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete account');
      }
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Failed to delete account',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle avatar as logo toggle (dev user only)
  const handleAvatarAsLogoToggle = (checked: boolean) => {
    setShowAvatarAsLogo(checked);
    localStorage.setItem('emtchat-show-avatar-as-logo', String(checked));
    // Notify Sidebar to update immediately
    onAvatarToggleChange?.(checked);
    toast({
      title: checked ? 'Avatar enabled' : 'Logo restored',
      description: checked
        ? 'Your avatar will show in the sidebar header.'
        : 'EMTChat logo will show in the sidebar header.',
    });
  };

  // Get avatar source
  const getAvatarSrc = () => {
    if (avatarPreview) return avatarPreview;
    if (settings.iconUrl) return settings.iconUrl;
    return `https://avatar.vercel.sh/${user?.username}.png`;
  };

  if (!user) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Profile Settings</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-11 sm:h-12 bg-muted/30 border border-border/50 rounded-lg p-1 gap-1">
              <TabsTrigger
                value="profile"
                className="text-xs sm:text-sm px-1.5 sm:px-3 rounded-md transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/50 flex items-center justify-center gap-1"
              >
                <User className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline truncate">Profile</span>
              </TabsTrigger>
              <TabsTrigger
                value="security"
                className="text-xs sm:text-sm px-1.5 sm:px-3 rounded-md transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/50 flex items-center justify-center gap-1"
              >
                <Lock className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline truncate">Security</span>
              </TabsTrigger>
              <TabsTrigger
                value="preferences"
                className="text-xs sm:text-sm px-1.5 sm:px-3 rounded-md transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/50 flex items-center justify-center gap-1"
              >
                <Palette className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline truncate">Theme</span>
              </TabsTrigger>
              <TabsTrigger
                value="ai"
                className="text-xs sm:text-sm px-1.5 sm:px-3 rounded-md transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/50 flex items-center justify-center gap-1"
              >
                <Bot className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline truncate">AI</span>
              </TabsTrigger>
              <TabsTrigger
                value="account"
                className="text-xs sm:text-sm px-1.5 sm:px-3 rounded-md transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-muted/50 flex items-center justify-center gap-1"
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline truncate">Account</span>
              </TabsTrigger>
            </TabsList>

            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6 pt-4">
              {/* Avatar Section */}
              <div className="flex flex-col items-center space-y-4">
                <div className="relative group">
                  <Avatar className="h-24 w-24 cursor-pointer" onClick={handleAvatarClick}>
                    <AvatarImage src={getAvatarSrc()} alt={user.username} />
                    <AvatarFallback className="text-2xl">
                      {user.username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    onClick={handleAvatarClick}
                  >
                    {isUploadingAvatar ? (
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    ) : (
                      <Camera className="h-6 w-6 text-white" />
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Click to upload a new profile picture
                </p>
              </div>

              {/* Dev user: Avatar as sidebar logo toggle */}
              {isDevUser && (avatarPreview || settings.iconUrl) && (
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
                  <div className="flex items-center gap-3">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Use as Sidebar Logo</p>
                      <p className="text-xs text-muted-foreground">
                        Replace EMTChat logo with your avatar
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={showAvatarAsLogo}
                    onCheckedChange={handleAvatarAsLogoToggle}
                  />
                </div>
              )}

              {/* User Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input value={user.username} disabled className="bg-muted" />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={user.email || 'No email set'} disabled className="bg-muted" />
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Input
                    value={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="space-y-6 pt-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Change Password</h3>

                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Enter new password (min 6 characters)"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>

                <Button
                  onClick={handlePasswordChange}
                  disabled={isChangingPassword || !currentPassword || !newPassword}
                  className="w-full"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Changing Password...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Change Password
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences" className="space-y-6 pt-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Theme</h3>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred color theme for the application.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    className="h-24 flex-col space-y-2"
                    onClick={() => handleThemeChange('light')}
                  >
                    <Sun className="h-8 w-8" />
                    <span>Light</span>
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    className="h-24 flex-col space-y-2"
                    onClick={() => handleThemeChange('dark')}
                  >
                    <Moon className="h-8 w-8" />
                    <span>Dark</span>
                  </Button>
                </div>
              </div>

              {/* Export Section */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-medium">Export Data</h3>
                <p className="text-sm text-muted-foreground">
                  Download all your chat history as a JSON file.
                </p>

                <Button
                  variant="outline"
                  onClick={handleExportChats}
                  disabled={isExporting}
                  className="w-full"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Export Chat History
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* AI Tab */}
            <TabsContent value="ai" className="pt-4">
              <AISettingsTab />
            </TabsContent>

            {/* Account Tab */}
            <TabsContent value="account" className="space-y-6 pt-4">
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-destructive">Danger Zone</h3>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data. This action cannot be
                  undone.
                </p>

                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Account
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                This action cannot be undone. This will permanently delete your account and remove
                all your data including:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All chat history</li>
                <li>Uploaded documents</li>
                <li>Profile settings</li>
                <li>Account credentials</li>
              </ul>
              <div className="pt-2">
                <Label htmlFor="delete-confirm">
                  Type <span className="font-bold">{user?.username}</span> to confirm:
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder="Type your username"
                  className="mt-2"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteConfirmText !== user?.username}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Account'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProfileDialog;
