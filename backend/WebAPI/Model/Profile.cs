namespace Five68.Model
{
	public class Profile
	{
		public required Guid Id { get; set; }
		public Guid? AuthUserId { get; set; } // to link to auth system
		public required string FullName { get; set; }
		public required string Email { get; set; }
		public required UserRole Role { get; set; }
		public string? Color { get; set; }
		public bool FirstLoginCompleted { get; set; } = false;
		public DateTime CreatedAt { get; set; }
		public DateTime UpdatedAt { get; set; }

		// Navigation
		public Employee? Employee { get; set; }
	}
}