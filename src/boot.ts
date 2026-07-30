import { applyDocumentTheme, readSystemPrefs } from '@/shared/utils/themeBoot'
import {
  applyBrowserDocumentClasses,
  installBrowserDocumentClasses,
  tuneEdgeViewportMeta,
} from '@/shared/utils/browserEnv'
import { installMobileKeyboardViewportGuard } from '@/shared/utils/mobileKeyboardViewport'
import { installSafeViewportHeight } from '@/shared/utils/safeViewport'

tuneEdgeViewportMeta()
applyDocumentTheme(readSystemPrefs())
applyBrowserDocumentClasses()
installBrowserDocumentClasses()
installSafeViewportHeight()
installMobileKeyboardViewportGuard()
