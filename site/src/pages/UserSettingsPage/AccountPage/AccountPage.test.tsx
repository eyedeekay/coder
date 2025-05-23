import { fireEvent, screen, waitFor } from "@testing-library/react";
import { API } from "api/api";
import { mockApiError } from "testHelpers/entities";
import { renderWithAuth } from "testHelpers/renderHelpers";
import * as AccountForm from "./AccountForm";
import AccountPage from "./AccountPage";

const newData = {
	username: "user",
	name: "Mr User",
};

const fillAndSubmitForm = async () => {
	await waitFor(() => screen.findByLabelText("Username"));
	fireEvent.change(screen.getByLabelText("Username"), {
		target: { value: newData.username },
	});
	await waitFor(() => screen.findByLabelText("Name"));
	fireEvent.change(screen.getByLabelText("Name"), {
		target: { value: newData.name },
	});
	fireEvent.click(screen.getByText(AccountForm.Language.updateSettings));
};

describe("AccountPage", () => {
	describe("when it is a success", () => {
		it("shows the success message", async () => {
			jest.spyOn(API, "updateProfile").mockImplementationOnce((userId, data) =>
				Promise.resolve({
					id: userId,
					email: "user@coder.com",
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
					status: "active",
					organization_ids: ["123"],
					roles: [],
					avatar_url: "",
					last_seen_at: new Date().toISOString(),
					login_type: "password",
					theme_preference: "",
					...data,
				}),
			);
			renderWithAuth(<AccountPage />);
			await fillAndSubmitForm();

			const successMessage = await screen.findByText("Updated settings.");
			expect(successMessage).toBeDefined();
			expect(API.updateProfile).toBeCalledTimes(1);
			expect(API.updateProfile).toBeCalledWith("me", newData);
		});
	});

	describe("when the username is already taken", () => {
		it("shows an error", async () => {
			jest.spyOn(API, "updateProfile").mockRejectedValueOnce(
				mockApiError({
					message: "Invalid profile",
					validations: [
						{ detail: "Username is already in use", field: "username" },
					],
				}),
			);

			renderWithAuth(<AccountPage />);
			await fillAndSubmitForm();

			const errorMessage = await screen.findByText(
				"Username is already in use",
			);
			expect(errorMessage).toBeDefined();
			expect(API.updateProfile).toBeCalledTimes(1);
			expect(API.updateProfile).toBeCalledWith("me", newData);
		});
	});

	describe("when it is an unknown error", () => {
		it("shows a generic error message", async () => {
			jest.spyOn(API, "updateProfile").mockRejectedValueOnce({
				data: "unknown error",
			});

			renderWithAuth(<AccountPage />);
			await fillAndSubmitForm();

			const errorMessage = await screen.findByText("Something went wrong.");
			expect(errorMessage).toBeDefined();
			expect(API.updateProfile).toBeCalledTimes(1);
			expect(API.updateProfile).toBeCalledWith("me", newData);
		});
	});
});
