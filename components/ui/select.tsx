"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, Check } from "lucide-react"

interface SelectContextType {
    value?: string
    onValueChange?: (value: string) => void
    open: boolean
    setOpen: (open: boolean) => void
    labels: Record<string, React.ReactNode>
}

const SelectContext = React.createContext<SelectContextType | null>(null)

export function Select({ value, onValueChange, children }: any) {
    const [open, setOpen] = React.useState(false)
    const ref = React.useRef<HTMLDivElement>(null)

    // Extract labels from children
    const labels = React.useMemo(() => {
        const map: Record<string, React.ReactNode> = {}

        const traverse = (nodes: React.ReactNode) => {
            React.Children.forEach(nodes, (child) => {
                if (!React.isValidElement(child)) return;

                const element = child as React.ReactElement<any>;

                // If it's a SelectItem, grab value and children (label)
                if ((element.type as any)?.displayName === "SelectItem") {
                    map[element.props.value] = element.props.children;
                }

                // If it's SelectContent, traverse its children
                if (element.props.children) {
                    traverse(element.props.children);
                }
            });
        }
        traverse(children);
        return map;
    }, [children]);

    React.useEffect(() => {
        const handle = (e: any) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener("mousedown", handle)
        return () => document.removeEventListener("mousedown", handle)
    }, [])

    return (
        <SelectContext.Provider value={{ value, onValueChange, open, setOpen, labels }}>
            <div className="relative" ref={ref}>
                {children}
            </div>
        </SelectContext.Provider>
    )
}

export function SelectTrigger({ className, children, ...props }: any) {
    const { open, setOpen } = React.useContext(SelectContext)!
    return (
        <button
            type="button"
            onClick={() => setOpen(!open)}
            className={cn("flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)}
            {...props}
        >
            {children}
            <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
    )
}

export function SelectContent({ className, children, ...props }: any) {
    const { open } = React.useContext(SelectContext)!
    if (!open) return null
    return (
        <div className={cn("absolute top-full mt-1 w-full rounded-md border bg-slate-900 border-slate-700 p-1 shadow-md z-[9999]", className)} {...props}>
            <div className="max-h-[300px] overflow-auto">
                {children}
            </div>
        </div>
    )
}

export function SelectItem({ className, children, value, ...props }: any) {
    const { onValueChange, setOpen, value: selectedValue } = React.useContext(SelectContext)!
    return (
        <div
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onValueChange?.(value)
                setOpen(false)
            }}
            className={cn("relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-slate-800 focus:bg-slate-800 text-slate-300 hover:text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer", className)}
            {...props}
        >
            {selectedValue === value && (
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center text-blue-500">
                    <Check className="h-4 w-4" />
                </span>
            )}
            <span className="truncate">{children}</span>
        </div>
    )
}
SelectItem.displayName = "SelectItem"; // Important for traversal

export function SelectValue({ className, placeholder, children }: any) {
    const { value, labels } = React.useContext(SelectContext)!
    const display = value ? (labels[value] || value) : (placeholder || children);
    return <span className={className}>{display}</span>
}

// Export aliases
// No aliases needed if we export functions directly.

