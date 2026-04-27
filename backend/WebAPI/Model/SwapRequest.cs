namespace Five68.Model
{
	public class SwapRequest
	{
		public required Guid Id { get; set; }
		public required Guid ShiftId { get; set; }
		public required Guid RequesterId { get; set; } // FK to Profile
		public required Guid TargetEmployeeId { get; set; } // FK to Profile
		public SwapRequestStatus Status { get; set; } = SwapRequestStatus.Pending;
		public DateTime CreatedAt { get; set; }
		public DateTime? RespondedAt { get; set; }

		public Shift Shift { get; set; } = null!;
		public Profile Requester { get; set; } = null!;
		public Profile TargetEmployee { get; set; } = null!;
	}
}