import { Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePWAInstall } from './usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => void install()}
        className="min-h-[44px] flex-1 gap-2 rounded-xl bg-background/50 px-3.5 text-xs font-medium whitespace-nowrap"
      >
        <Download className="h-4 w-4 text-primary" />
        Install Offline App
      </Button>
    );
  }

  if (isIOS) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowIOSGuide(true)}
          className="min-h-[44px] flex-1 gap-2 rounded-xl bg-background/50 px-3.5 text-xs font-medium whitespace-nowrap"
        >
          <Download className="h-4 w-4 text-primary" />
          Install on iPhone
        </Button>

        <Dialog open={showIOSGuide} onOpenChange={setShowIOSGuide}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display text-base font-semibold">
                Install Folio on iPhone / iPad
              </DialogTitle>
              <DialogDescription className="pt-1 text-sm leading-relaxed">
                1. Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
                <br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-2 bg-transparent p-0 sm:mx-0 sm:mb-0 sm:border-0">
              <Button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="min-h-[44px] w-full rounded-xl text-sm font-semibold"
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return null;
}
