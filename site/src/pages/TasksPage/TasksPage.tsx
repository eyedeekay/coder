import Skeleton from "@mui/material/Skeleton";
import { API } from "api/api";
import { getErrorDetail, getErrorMessage } from "api/errors";
import { disabledRefetchOptions } from "api/queries/util";
import type { Template } from "api/typesGenerated";
import { ErrorAlert } from "components/Alert/ErrorAlert";
import { Avatar } from "components/Avatar/Avatar";
import { AvatarData } from "components/Avatar/AvatarData";
import { AvatarDataSkeleton } from "components/Avatar/AvatarDataSkeleton";
import { Button } from "components/Button/Button";
import { Form, FormFields, FormSection } from "components/Form/Form";
import { displayError } from "components/GlobalSnackbar/utils";
import { Margins } from "components/Margins/Margins";
import {
	PageHeader,
	PageHeaderSubtitle,
	PageHeaderTitle,
} from "components/PageHeader/PageHeader";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "components/Select/Select";
import { Spinner } from "components/Spinner/Spinner";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "components/Table/Table";
import {
	TableLoaderSkeleton,
	TableRowSkeleton,
} from "components/TableLoader/TableLoader";

import { useAuthenticated } from "hooks";
import { useExternalAuth } from "hooks/useExternalAuth";
import { RotateCcwIcon, SendIcon } from "lucide-react";
import { AI_PROMPT_PARAMETER_NAME, type Task } from "modules/tasks/tasks";
import { WorkspaceAppStatus } from "modules/workspaces/WorkspaceAppStatus/WorkspaceAppStatus";
import { generateWorkspaceName } from "modules/workspaces/generateWorkspaceName";
import { type FC, type ReactNode, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Link as RouterLink } from "react-router-dom";
import TextareaAutosize from "react-textarea-autosize";
import { pageTitle } from "utils/page";
import { relativeTime } from "utils/time";
import { ExternalAuthButton } from "../CreateWorkspacePage/ExternalAuthButton";
import { type UserOption, UsersCombobox } from "./UsersCombobox";

type TasksFilter = {
	user: UserOption | undefined;
};
const TasksPage: FC = () => {
	const { user, permissions } = useAuthenticated();
	const [filter, setFilter] = useState<TasksFilter>({
		user: {
			value: user.username,
			label: user.name || user.username,
			avatarUrl: user.avatar_url,
		},
	});

	return (
		<>
			<Helmet>
				<title>{pageTitle("AI Tasks")}</title>
			</Helmet>
			<Margins>
				<PageHeader>
					<PageHeaderTitle>Tasks</PageHeaderTitle>
					<PageHeaderSubtitle>Automate tasks with AI</PageHeaderSubtitle>
				</PageHeader>

				<main className="pb-8">
					<TaskFormSection
						showFilter={permissions.viewDeploymentConfig}
						filter={filter}
						onFilterChange={setFilter}
					/>
					<TasksTable filter={filter} />
				</main>
			</Margins>
		</>
	);
};

const textareaPlaceholder = "Prompt your AI agent to start a task...";

const LoadingTemplatesPlaceholder: FC = () => {
	return (
		<div className="border border-border border-solid rounded-lg p-4">
			<div className="space-y-4">
				{/* Textarea skeleton */}
				<TextareaAutosize
					disabled
					id="prompt"
					name="prompt"
					placeholder={textareaPlaceholder}
					className={`border-0 resize-none w-full h-full bg-transparent rounded-lg outline-none flex min-h-[60px]
				text-sm shadow-sm text-content-primary placeholder:text-content-secondary md:text-sm`}
				/>

				{/* Bottom controls skeleton */}
				<div className="flex items-center justify-between pt-2">
					<Skeleton variant="rounded" width={208} height={32} />
					<Skeleton variant="rounded" width={96} height={32} />
				</div>
			</div>
		</div>
	);
};

const NoTemplatesPlaceholder: FC = () => {
	return (
		<div className="rounded-lg border border-solid border-border w-full min-h-80 p-4 flex items-center justify-center">
			<div className="flex flex-col items-center">
				<h3 className="m-0 font-medium text-content-primary text-base">
					No Task templates found
				</h3>
				<span className="text-content-secondary text-sm">
					Create a Task template to get started
				</span>
			</div>
		</div>
	);
};

const ErrorContent: FC<{
	title: string;
	detail: string;
	onRetry: () => void;
}> = ({ title, detail, onRetry }) => {
	return (
		<div className="border border-solid rounded-lg w-full min-h-80 flex items-center justify-center">
			<div className="flex flex-col items-center">
				<h3 className="m-0 font-medium text-content-primary text-base">
					{title}
				</h3>
				<span className="text-content-secondary text-sm">{detail}</span>
				<Button size="sm" onClick={onRetry} className="mt-4">
					<RotateCcwIcon />
					Try again
				</Button>
			</div>
		</div>
	);
};

const TaskFormSection: FC<{
	showFilter: boolean;
	filter: TasksFilter;
	onFilterChange: (filter: TasksFilter) => void;
}> = ({ showFilter, filter, onFilterChange }) => {
	const {
		data: templates,
		error,
		refetch,
	} = useQuery({
		queryKey: ["templates", "ai"],
		queryFn: data.fetchAITemplates,
		...disabledRefetchOptions,
	});

	if (error) {
		return (
			<ErrorContent
				title={getErrorMessage(error, "Error loading Task templates")}
				detail={getErrorDetail(error) ?? "Please try again"}
				onRetry={() => refetch()}
			/>
		);
	}
	if (templates === undefined) {
		return <LoadingTemplatesPlaceholder />;
	}
	if (templates.length === 0) {
		return <NoTemplatesPlaceholder />;
	}
	return (
		<>
			<TaskForm templates={templates} />
			{showFilter && (
				<TasksFilter filter={filter} onFilterChange={onFilterChange} />
			)}
		</>
	);
};

type CreateTaskMutationFnProps = { prompt: string; templateId: string };

type TaskFormProps = {
	templates: Template[];
};

const TaskForm: FC<TaskFormProps> = ({ templates }) => {
	const { user } = useAuthenticated();
	const queryClient = useQueryClient();

	const [templateId, setTemplateId] = useState<string>(templates[0].id);
	const {
		externalAuth,
		externalAuthPollingState,
		startPollingExternalAuth,
		isLoadingExternalAuth,
		externalAuthError,
	} = useExternalAuth(
		templates.find((t) => t.id === templateId)?.active_version_id,
	);

	const hasAllRequiredExternalAuth = externalAuth?.every(
		(auth) => auth.optional || auth.authenticated,
	);

	const createTaskMutation = useMutation({
		mutationFn: async ({ prompt, templateId }: CreateTaskMutationFnProps) =>
			data.createTask(prompt, user.id, templateId),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: ["tasks"],
			});
		},
	});

	const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		const form = e.currentTarget;
		const formData = new FormData(form);
		const prompt = formData.get("prompt") as string;
		const templateID = formData.get("templateID") as string;

		if (!prompt || !templateID) {
			return;
		}

		try {
			await createTaskMutation.mutateAsync({
				prompt,
				templateId: templateID,
			});
			form.reset();
		} catch (error) {
			const message = getErrorMessage(error, "Error creating task");
			const detail = getErrorDetail(error) ?? "Please try again";
			displayError(message, detail);
		}
	};

	return (
		<Form onSubmit={onSubmit} aria-label="Create AI task">
			{Boolean(externalAuthError) && <ErrorAlert error={externalAuthError} />}

			<fieldset
				className="border border-border border-solid rounded-lg p-4"
				disabled={createTaskMutation.isPending}
			>
				<label htmlFor="prompt" className="sr-only">
					Prompt
				</label>
				<TextareaAutosize
					required
					id="prompt"
					name="prompt"
					placeholder={textareaPlaceholder}
					className={`border-0 resize-none w-full h-full bg-transparent rounded-lg outline-none flex min-h-[60px]
						text-sm shadow-sm text-content-primary placeholder:text-content-secondary md:text-sm`}
				/>
				<div className="flex items-center justify-between pt-2">
					<Select
						name="templateID"
						onValueChange={(value) => setTemplateId(value)}
						defaultValue={templates[0].id}
						required
					>
						<SelectTrigger className="w-52 text-xs [&_svg]:size-icon-xs border-0 bg-surface-secondary h-8 px-3">
							<SelectValue placeholder="Select a template" />
						</SelectTrigger>
						<SelectContent>
							{templates.map((template) => {
								return (
									<SelectItem value={template.id} key={template.id}>
										<span className="overflow-hidden text-ellipsis block">
											{template.display_name || template.name}
										</span>
									</SelectItem>
								);
							})}
						</SelectContent>
					</Select>

					<Button
						size="sm"
						type="submit"
						disabled={!hasAllRequiredExternalAuth}
					>
						<Spinner
							loading={createTaskMutation.isPending || isLoadingExternalAuth}
						>
							<SendIcon />
						</Spinner>
						Run task
					</Button>
				</div>
			</fieldset>

			{!hasAllRequiredExternalAuth &&
				externalAuth &&
				externalAuth.length > 0 && (
					<FormSection
						title="External Authentication"
						description="This template uses external services for authentication."
					>
						<FormFields>
							{externalAuth.map((auth) => (
								<ExternalAuthButton
									key={auth.id}
									auth={auth}
									isLoading={externalAuthPollingState === "polling"}
									onStartPolling={startPollingExternalAuth}
									displayRetry={externalAuthPollingState === "abandoned"}
								/>
							))}
						</FormFields>
					</FormSection>
				)}
		</Form>
	);
};

type TasksFilterProps = {
	filter: TasksFilter;
	onFilterChange: (filter: TasksFilter) => void;
};

const TasksFilter: FC<TasksFilterProps> = ({ filter, onFilterChange }) => {
	return (
		<section className="mt-6" aria-labelledby="filters-title">
			<h3 id="filters-title" className="sr-only">
				Filters
			</h3>
			<UsersCombobox
				selectedOption={filter.user}
				onSelect={(userOption) =>
					onFilterChange({
						...filter,
						user: userOption,
					})
				}
			/>
		</section>
	);
};

type TasksTableProps = {
	filter: TasksFilter;
};

const TasksTable: FC<TasksTableProps> = ({ filter }) => {
	const {
		data: tasks,
		error,
		refetch,
	} = useQuery({
		queryKey: ["tasks", filter],
		queryFn: () => data.fetchTasks(filter),
		refetchInterval: 10_000,
	});

	let body: ReactNode = null;

	if (error) {
		const message = getErrorMessage(error, "Error loading tasks");
		const detail = getErrorDetail(error) ?? "Please try again";

		body = (
			<TableRow>
				<TableCell colSpan={4} className="text-center">
					<div className="rounded-lg w-full min-h-80 flex items-center justify-center">
						<div className="flex flex-col items-center">
							<h3 className="m-0 font-medium text-content-primary text-base">
								{message}
							</h3>
							<span className="text-content-secondary text-sm">{detail}</span>
							<Button size="sm" onClick={() => refetch()} className="mt-4">
								<RotateCcwIcon />
								Try again
							</Button>
						</div>
					</div>
				</TableCell>
			</TableRow>
		);
	} else if (tasks) {
		body =
			tasks.length === 0 ? (
				<TableRow>
					<TableCell colSpan={4} className="text-center">
						<div className="w-full min-h-80 p-4 flex items-center justify-center">
							<div className="flex flex-col items-center">
								<h3 className="m-0 font-medium text-content-primary text-base">
									No tasks found
								</h3>
								<span className="text-content-secondary text-sm">
									Use the form above to run a task
								</span>
							</div>
						</div>
					</TableCell>
				</TableRow>
			) : (
				tasks.map(({ workspace, prompt }) => {
					const templateDisplayName =
						workspace.template_display_name ?? workspace.template_name;

					return (
						<TableRow key={workspace.id} className="relative" hover>
							<TableCell>
								<AvatarData
									title={
										<>
											<span className="block max-w-[520px] overflow-hidden text-ellipsis whitespace-nowrap">
												{prompt}
											</span>
											<RouterLink
												to={`/tasks/${workspace.owner_name}/${workspace.name}`}
												className="absolute inset-0"
											>
												<span className="sr-only">Access task</span>
											</RouterLink>
										</>
									}
									subtitle={templateDisplayName}
									avatar={
										<Avatar
											size="lg"
											variant="icon"
											src={workspace.template_icon}
											fallback={templateDisplayName}
										/>
									}
								/>
							</TableCell>
							<TableCell>
								<WorkspaceAppStatus
									disabled={workspace.latest_build.status !== "running"}
									status={workspace.latest_app_status}
								/>
							</TableCell>
							<TableCell>
								<AvatarData
									title={workspace.owner_name}
									subtitle={
										<span className="block first-letter:uppercase">
											{relativeTime(new Date(workspace.created_at))}
										</span>
									}
									src={workspace.owner_avatar_url}
								/>
							</TableCell>
						</TableRow>
					);
				})
			);
	} else {
		body = (
			<TableLoaderSkeleton>
				<TableRowSkeleton>
					<TableCell>
						<AvatarDataSkeleton />
					</TableCell>
					<TableCell>
						<Skeleton variant="rounded" width={100} height={24} />
					</TableCell>
					<TableCell>
						<AvatarDataSkeleton />
					</TableCell>
				</TableRowSkeleton>
			</TableLoaderSkeleton>
		);
	}

	return (
		<Table className="mt-4">
			<TableHeader>
				<TableRow>
					<TableHead>Task</TableHead>
					<TableHead>Status</TableHead>
					<TableHead>Created by</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>{body}</TableBody>
		</Table>
	);
};

export const data = {
	async fetchAITemplates() {
		return API.getTemplates({ q: "has-ai-task:true" });
	},

	async fetchTasks(filter: TasksFilter) {
		let filterQuery = "has-ai-task:true";
		if (filter.user) {
			filterQuery += ` owner:${filter.user.value}`;
		}
		const workspaces = await API.getWorkspaces({
			q: filterQuery,
		});
		const prompts = await API.experimental.getAITasksPrompts(
			workspaces.workspaces.map((workspace) => workspace.latest_build.id),
		);
		return workspaces.workspaces.map((workspace) => {
			let prompt = prompts.prompts[workspace.latest_build.id];
			if (prompt === undefined) {
				prompt = "Unknown prompt";
			} else if (prompt === "") {
				prompt = "Empty prompt";
			}
			return {
				workspace,
				prompt,
			} satisfies Task;
		});
	},

	async createTask(
		prompt: string,
		userId: string,
		templateId: string,
	): Promise<Task> {
		const workspace = await API.createWorkspace(userId, {
			name: `task-${generateWorkspaceName()}`,
			template_id: templateId,
			rich_parameter_values: [
				{ name: AI_PROMPT_PARAMETER_NAME, value: prompt },
			],
		});

		return {
			workspace,
			prompt,
		};
	},
};

export default TasksPage;
