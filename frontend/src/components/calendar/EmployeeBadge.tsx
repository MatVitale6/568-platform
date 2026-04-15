interface EmployeeBadgeProps {
  name: string
  color: string
  partial: boolean
  isCurrentUser: boolean
}

export default function EmployeeBadge({ name, color, partial, isCurrentUser }: EmployeeBadgeProps) {
	return (
		<span
			className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white shadow-sm whitespace-nowrap ${
				isCurrentUser ? 'ring-2 ring-offset-1 ring-white' : ''
			}`}
			style={{ backgroundColor: color }}
		>
			{name}
			{partial && <span className="font-bold opacity-90">½</span>}
		</span>
	);
}
