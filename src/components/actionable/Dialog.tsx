// "use client";

// import React, { useEffect } from "react";
// import { IconButton } from "./IconButtons";
// import { Icon } from "../icons";
// import { motion, AnimatePresence } from "motion/react";

// export type DialogType = "overlay" | "bottom" | "bottom-floating";

// export interface DialogProps {
//   open: boolean;
//   onClose: () => void;
//   title?: string;
//   children?: React.ReactNode;
//   footer?: React.ReactNode;
//   type?: DialogType;
//   className?: string;
// }

// export const Dialog: React.FC<DialogProps> = ({
//   open,
//   onClose,
//   title,
//   children,
//   footer,
//   type = "overlay",
//   className,
// }) => {
//   // ป้องกัน scroll หลัง dialog
//   useEffect(() => {
//     if (open) document.body.style.overflow = "hidden";
//     else document.body.style.overflow = "";
//     return () => {
//       document.body.style.overflow = "";
//     };
//   }, [open]);

//   return (
//     <AnimatePresence>
//       {open && (
//         <motion.div
//           className={`
//             fixed inset-0 z-999 bg-black/50 flex transition-all
//             ${
//               type === "overlay"
//                 ? "items-center justify-center"
//                 : "items-end justify-center"
//             }
//           `}
//           initial={{ opacity: 0 }}
//           animate={{ opacity: 1 }}
//           exit={{ opacity: 0 }}
//           onClick={onClose} // คลิกนอกปิด
//         >
//           {/* Card container */}
//           <motion.div
//             onClick={(e) => e.stopPropagation()}
//             initial={
//               type === "overlay"
//                 ? { scale: 0.9, opacity: 0 }
//                 : { y: 80, opacity: 0 } // bottom sheet animation
//             }
//             animate={
//               type === "overlay"
//                 ? { scale: 1, opacity: 1 }
//                 : { y: 0, opacity: 1 }
//             }
//             exit={
//               type === "overlay"
//                 ? { scale: 0.9, opacity: 0 }
//                 : { y: 80, opacity: 0 }
//             }
//             transition={{ duration: 0.25, ease: "easeOut" }}
//             className={`
//               flex flex-col w-full bg-background-default-default gap-4  p-4 relative dropshadow-400
//               ${
//                 type === "overlay"
//                   ? "mx-6 sm:mx-0 sm:max-w-md  rounded-3xl"
//                   : type === "bottom"
//                   ? "rounded-t-2xl"
//                   : "rounded-t-3xl"
//               }
//               ${className ?? ""}
//             `}
//           >
//             {/* Header */}
//             <header className="flex w-full justify-between items-center">
//               {title && (
//                 <h2 className="text-sm font-semibold text-text-default-default">
//                   {title}
//                 </h2>
//               )}

//               <IconButton
//                 variant="filled"
//                 color="default"
//                 size="small"
//                 onClick={onClose}
//               >
//                 <Icon name="XClose" />
//               </IconButton>
//             </header>

//             {/* Content */}
//             <div className="text-sm text-text-default-default">{children}</div>

//             {/* Footer */}
//             {footer && <div className="flex justify-end gap-3">{footer}</div>}
//           </motion.div>
//         </motion.div>
//       )}
//     </AnimatePresence>
//   );
// };

"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { IconButton } from "./IconButtons";
import { Icon } from "../icons";
import { motion, AnimatePresence } from "motion/react";

/* -------------------------------------------------- */
/* Types                                              */
/* -------------------------------------------------- */
export type DialogType = "overlay" | "bottom" | "bottom-floating";

type DialogRootProps = {
  /** controlled (optional) */
  open?: boolean;
  /** uncontrolled (optional) */
  defaultOpen?: boolean;

  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;

  type?: DialogType;
  children: React.ReactNode;
};

type DialogContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  type: DialogType;
};

/* -------------------------------------------------- */
/* Context                                            */
/* -------------------------------------------------- */
const DialogContext = createContext<DialogContextValue | null>(null);

const useDialog = () => {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("Dialog.* must be used inside Dialog.Root");
  return ctx;
};

/* -------------------------------------------------- */
/* Root                                               */
/* -------------------------------------------------- */
const DialogRoot: React.FC<DialogRootProps> = ({
  open: openProp,
  defaultOpen = false,
  onClose,
  onOpenChange,
  type = "overlay",
  children,
}) => {
  const isControlled = typeof openProp === "boolean";
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);

  const open = isControlled ? (openProp as boolean) : uncontrolledOpen;

  const setOpen = (v: boolean) => {
    if (!v) onClose?.();
    onOpenChange?.(v);

    if (!isControlled) {
      setUncontrolledOpen(v);
    }
  };

  // lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const value = useMemo(
    () => ({ open, setOpen, type }),
    [open, type]
  );

  return (
    <DialogContext.Provider value={value}>
      {children}
    </DialogContext.Provider>
  );
};

/* -------------------------------------------------- */
/* Trigger                                            */
/* -------------------------------------------------- */
type DialogTriggerProps = {
  children: React.ReactElement<{
    onClick?: React.MouseEventHandler;
  }>;
};

const DialogTrigger: React.FC<DialogTriggerProps> = ({ children }) => {
  const { setOpen } = useDialog();

  return React.cloneElement(children, {
    onClick: (e: React.MouseEvent) => {
      children.props.onClick?.(e);
      setOpen(true);
    },
  });
};

/* -------------------------------------------------- */
/* Content                                            */
/* -------------------------------------------------- */
const DialogContent: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const { open, setOpen, type } = useDialog();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`
            fixed inset-0 z-999 bg-black/50 flex
            ${
              type === "overlay"
                ? "items-center justify-center"
                : "items-end justify-center"
            }
          `}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={
              type === "overlay"
                ? { scale: 0.9, opacity: 0 }
                : { y: 80, opacity: 0 }
            }
            animate={
              type === "overlay"
                ? { scale: 1, opacity: 1 }
                : { y: 0, opacity: 1 }
            }
            exit={
              type === "overlay"
                ? { scale: 0.9, opacity: 0 }
                : { y: 80, opacity: 0 }
            }
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`
              flex flex-col w-full bg-background-default-default gap-4 p-4 relative dropshadow-400
              ${
                type === "overlay"
                  ? "mx-6 sm:mx-0 sm:max-w-md rounded-3xl"
                  : type === "bottom"
                  ? "rounded-t-2xl"
                  : "rounded-t-3xl"
              }
              ${className ?? ""}
            `}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* -------------------------------------------------- */
/* Header / Body / Footer                             */
/* -------------------------------------------------- */
const DialogHeader: React.FC<{ title?: string }> = ({ title }) => {
  const { setOpen } = useDialog();

  return (
    <header className="flex w-full justify-between items-center">
      {title && (
        <h2 className="text-sm font-semibold text-text-default-default">
          {title}
        </h2>
      )}

      <IconButton
        variant="filled"
        color="default"
        size="small"
        onClick={() => setOpen(false)}
      >
        <Icon name="XClose" />
      </IconButton>
    </header>
  );
};

const DialogBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="text-sm text-text-default-default">{children}</div>
);

const DialogFooter: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex justify-end gap-3">{children}</div>
);

/* -------------------------------------------------- */
/* Export Namespace                                   */
/* -------------------------------------------------- */
export const Dialog = {
  Root: DialogRoot,
  Trigger: DialogTrigger,
  Content: DialogContent,
  Header: DialogHeader,
  Body: DialogBody,
  Footer: DialogFooter,
};
