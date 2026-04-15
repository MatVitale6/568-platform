import { mergeProps } from '@base-ui/react/merge-props';
import { useRender, type UseRenderRenderProp } from '@base-ui/react/use-render';

import { cn } from '@/lib/utils';
import React from 'react';
import { badgeVariants } from './badge-utils';

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "ghost" | "link";

interface BadgeState {
	slot: string;
	variant: BadgeVariant;
}

interface BadgeProps extends React.ComponentPropsWithoutRef<"span"> {
	variant?: BadgeVariant;
	render?: UseRenderRenderProp<BadgeState>;
}

function Badge({
	className,
	variant = "default",
	render,
	...props
}: BadgeProps) {
	return useRender({
		defaultTagName: "span",
		props: mergeProps({
			className: cn(badgeVariants({ variant }), className),
		}, props),
		render,
		state: {
			slot: "badge",
			variant,
		},
	});
}

export { Badge };
