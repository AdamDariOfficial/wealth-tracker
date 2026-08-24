import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/use-i18n";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2 md:h-9",
        sm: "h-11 rounded-lg px-3 text-xs md:h-8",
        lg: "h-12 rounded-lg px-8 md:h-10",
        icon: "h-11 w-11 md:h-9 md:w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const { t } = useI18n();
    const translateNode = (child: React.ReactNode): React.ReactNode => {
      if (typeof child === "string") return t(child);
      if (
        React.isValidElement<{ children?: React.ReactNode }>(child) &&
        typeof child.type === "string" &&
        child.props.children !== undefined
      ) {
        return React.cloneElement(
          child,
          undefined,
          React.Children.map(child.props.children, translateNode),
        );
      }
      return child;
    };
    const translated = React.Children.map(children, translateNode);
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {translated}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
